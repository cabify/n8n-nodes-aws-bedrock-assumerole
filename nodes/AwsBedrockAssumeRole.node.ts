import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Module-level cache for temporary credentials
const credentialCache: { [key: string]: any } = {};

// Resolve base credentials from provided fields or environment variables (with trimming)
function resolveBase(credentials: any) {
	const fromEnv = (v: any) => (typeof v === 'string' ? v.trim() : v);
	const resolved = {
		accessKeyId: credentials.accessKeyId || fromEnv(process.env.AWS_ACCESS_KEY_ID),
		secretAccessKey: credentials.secretAccessKey || fromEnv(process.env.AWS_SECRET_ACCESS_KEY),
		roleArn: credentials.roleArn || fromEnv(process.env.AWS_ROLE_ARN),
		region: credentials.region || fromEnv(process.env.AWS_REGION) || 'us-east-1',
		durationSeconds: credentials.durationSeconds || 3600,
	};

	console.log('[AWS Bedrock] Resolved credentials:', {
		accessKeyIdSource: credentials.accessKeyId ? 'credential' : 'env',
		accessKeyIdPrefix: resolved.accessKeyId ? resolved.accessKeyId.substring(0, 8) + '...' : 'MISSING',
		secretAccessKeySource: credentials.secretAccessKey ? 'credential' : 'env',
		secretAccessKeyLength: resolved.secretAccessKey ? resolved.secretAccessKey.length : 0,
		roleArn: resolved.roleArn,
		region: resolved.region,
		durationSeconds: resolved.durationSeconds,
	});

	return resolved;
}

// Resolve effective model identifier based on optional application inference profile configuration
export function resolveEffectiveModelId(params: {
	modelId: string;
	region: string;
	applicationInferenceProfileAccountId?: string;
	applicationInferenceProfileId?: string;
	applicationInferenceProfiles?: unknown;
}): string {
	const baseModelId = params.modelId;
	const accountId = params.applicationInferenceProfileAccountId?.toString().trim();

	// If there is no account configured for application inference profiles, fall back to the base model ID
	if (!accountId) {
		return baseModelId;
	}

	// Prefer per-model profile configuration when available
	const profilesContainer = params.applicationInferenceProfiles as
		| {
				profiles?: Array<{
					modelId?: string;
					profileId?: string;
				}>;
		  }
		| undefined;

	let profileId: string | undefined;

	if (profilesContainer?.profiles && Array.isArray(profilesContainer.profiles)) {
		const matchedProfile = profilesContainer.profiles.find((profile) => {
			const profileModelId = profile.modelId?.toString().trim();
			return profileModelId === baseModelId;
		});

		if (matchedProfile?.profileId) {
			profileId = matchedProfile.profileId.toString().trim();
		}
	}

	// Fallback to legacy single profile id if still provided
	if (!profileId && params.applicationInferenceProfileId) {
		profileId = params.applicationInferenceProfileId.toString().trim();
	}

	if (profileId) {
		return `arn:aws:bedrock:${params.region}:${accountId}:application-inference-profile/${profileId}`;
	}

	// No profile configured for this model - use standard model id
	return baseModelId;
}

// Build application inference profiles container from JSON mapping in credentials
export function buildApplicationInferenceProfilesFromJson(jsonText?: string):
	| {
			profiles?: Array<{
				modelId?: string;
				profileId?: string;
			}>;
		}
	| undefined {
	if (!jsonText || typeof jsonText !== 'string') {
		return undefined;
	}

	const trimmed = jsonText.trim();
	if (!trimmed) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(trimmed) as Record<string, unknown>;

		if (!parsed || typeof parsed !== 'object') {
			return undefined;
		}

		const profiles: Array<{ modelId?: string; profileId?: string }> = [];

		for (const [modelId, profileId] of Object.entries(parsed)) {
			if (typeof modelId === 'string' && typeof profileId === 'string') {
				const normalizedModelId = modelId.trim();
				const normalizedProfileId = profileId.trim();

				if (normalizedModelId && normalizedProfileId) {
					profiles.push({
						modelId: normalizedModelId,
						profileId: normalizedProfileId,
					});
				}
			}
		}

		if (profiles.length === 0) {
			return undefined;
		}

		return { profiles };
	} catch (error: any) {
		throw new Error(
			`Invalid JSON in \"Application Inference Profiles JSON\" credential field: ${
				error?.message ?? String(error)
			}`,
		);
	}
}


// Build Claude messages API content for text-only or image+text inputs
export function buildClaudeMessageContent(args: {
	inputType: 'text' | 'image';
	prompt: string;
	binary?: {
		data?: string;
		mimeType?: string;
	};
}): string | Array<{ type: string; [key: string]: any }> {
	const trimmedPrompt = typeof args.prompt === 'string' ? args.prompt : '';

	if (args.inputType !== 'image') {
		return trimmedPrompt;
	}

	if (!args.binary || typeof args.binary.data !== 'string' || !args.binary.data) {
		throw new Error('Missing binary image data for image input.');
	}

	const mediaType =
		(args.binary.mimeType && args.binary.mimeType.toString().trim()) || 'image/png';

	return [
		{
			type: 'image',
			source: {
				type: 'base64',
				media_type: mediaType,
				data: args.binary.data,
			},
		},
		{
			type: 'text',
			text: trimmedPrompt,
		},
	];
}


// Helper function: Get cached credentials or fetch new ones
async function getCachedOrFetchCredentials(credentials: any) {
	const cacheKey = `${credentials.accessKeyId}:${credentials.roleArn}`;
	const cached = credentialCache[cacheKey];

	// Check if cached credentials are still valid (with 5-minute buffer)
	if (cached && cached.Expiration) {
		const expirationTime = new Date(cached.Expiration).getTime();
		const now = Date.now();
		const bufferMs = 5 * 60 * 1000; // 5 minutes

		if (expirationTime - now > bufferMs) {
			return cached;
		}
	}

	// Fetch new credentials
	const newCreds = await assumeRole(credentials);
	credentialCache[cacheKey] = newCreds;
	return newCreds;
}

// Helper function: Execute AssumeRole
async function assumeRole(credentials: any) {
	console.log('[AWS Bedrock] Starting AssumeRole process...');

	const fromEnv = (v: any) => (typeof v === 'string' ? v.trim() : v);
	const accessKeyId = credentials.accessKeyId || fromEnv(process.env.AWS_ACCESS_KEY_ID);
	const secretAccessKey = credentials.secretAccessKey || fromEnv(process.env.AWS_SECRET_ACCESS_KEY);
	const region = credentials.region || fromEnv(process.env.AWS_REGION) || 'us-east-1';
	const roleArn = credentials.roleArn || fromEnv(process.env.AWS_ROLE_ARN);

	if (!accessKeyId || !secretAccessKey) {
		console.error('[AWS Bedrock] Missing AWS base credentials');
		throw new Error('Missing AWS base credentials. Provide them via environment variables or credential fields.');
	}

	console.log('[AWS Bedrock] AssumeRole parameters:', {
		roleArn,
		region,
		durationSeconds: credentials.durationSeconds || 3600,
		accessKeyIdPrefix: accessKeyId.substring(0, 8) + '...',
	});

	const sts = new STSClient({
		region: region,
		credentials: {
			accessKeyId: accessKeyId,
			secretAccessKey: secretAccessKey,
		},
	});

	try {
		const result = await sts.send(
			new AssumeRoleCommand({
				RoleArn: roleArn,
				RoleSessionName: 'n8n-bedrock-session',
				DurationSeconds: credentials.durationSeconds || 3600,
			}),
		);

		if (!result.Credentials) {
			throw new Error('Failed to obtain temporary credentials from STS');
		}

		console.log('[AWS Bedrock] AssumeRole successful:', {
			accessKeyIdPrefix: result.Credentials.AccessKeyId!.substring(0, 8) + '...',
			expiration: result.Credentials.Expiration,
			expiresIn: Math.floor((new Date(result.Credentials.Expiration!).getTime() - new Date().getTime()) / 1000) + 's',
		});

		return result.Credentials;
	} catch (error: any) {
		console.error('[AWS Bedrock] AssumeRole failed:', {
			error: error.message,
			code: error.Code || error.name,
			roleArn,
		});
		throw error;
	}
}

export class AwsBedrockAssumeRole implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AWS Bedrock (AssumeRole)',
		name: 'awsBedrockAssumeRole',
		icon: 'file:bedrock.svg',
		group: ['transform'],
		version: 1,
		description: 'Interact with AWS Bedrock using AssumeRole authentication',
		defaults: {
			name: 'AWS Bedrock (AssumeRole)',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'awsAssumeRole',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Model ID',
				name: 'modelId',
				type: 'options',
				options: [],
				typeOptions: {
					loadOptionsMethod: 'getModelOptions',
				},
				default: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
				required: true,
				description:
					'The model ID to use for the request. When Application Inference Profiles JSON is configured in the credentials, only the models present in that JSON will be listed here.',
			},
			{
				displayName: 'Input Type',
				name: 'inputType',
				type: 'options',
				options: [
					{
						name: 'Text Only',
						value: 'text',
					},
					{
						name: 'Text and Image',
						value: 'image',
					},
				],
				default: 'text',
				required: true,
				description:
					'Choose whether to send only text or a combination of image and text to the model.',
			},
			{
				displayName: 'Image Binary Property',
				name: 'imageBinaryPropertyName',
				type: 'string',
				default: 'data',
				required: false,
				description: 'Name of the binary property that contains the image to analyze.',
				displayOptions: {
					show: {
						inputType: ['image'],
					},
				},
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				required: true,
				description: 'The prompt to send to the model',
			},
			{
				displayName: 'Max Tokens',
				name: 'maxTokens',
				type: 'number',
				default: 1000,
				required: true,
				description: 'Maximum number of tokens to generate',
			},
			{
				displayName: 'Temperature',
				name: 'temperature',
				type: 'number',
				typeOptions: {
					minValue: 0,
					maxValue: 1,
					numberStepSize: 0.1,
				},
				default: 0.7,
				required: false,
				description: 'Controls randomness in the response (0.0 to 1.0)',
			},
		],
	};


	methods = {
		loadOptions: {
			async getModelOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const staticOptions: INodePropertyOptions[] = [
					{
						name: 'Claude 3.5 Sonnet v2',
						value: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
					},
					{
						name: 'Claude 3.5 Sonnet v1',
						value: 'us.anthropic.claude-3-5-sonnet-20240620-v1:0',
					},
					{
						name: 'Claude 3.5 Haiku',
						value: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
					},
					{
						name: 'Claude 3.7 Sonnet',
						value: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
					},
					{
						name: 'Claude Sonnet 4',
						value: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
					},
					{
						name: 'Claude Sonnet 4.5',
						value: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
					},
					{
						name: 'Claude Haiku 4.5',
						value: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
					},
					{
						name: 'Claude Opus 4',
						value: 'us.anthropic.claude-opus-4-20250514-v1:0',
					},
					{
						name: 'Claude Opus 4.1',
						value: 'us.anthropic.claude-opus-4-1-20250805-v1:0',
					},
				];

				let credential: unknown;
				try {
					credential = await this.getCredentials('awsAssumeRole');
				} catch {
					// If credentials are not configured yet, fall back to static options
					return staticOptions;
				}

				const rawCredsRecord = credential as { [key: string]: any };
				const jsonText = rawCredsRecord.applicationInferenceProfilesJson as string | undefined;

				if (!jsonText || typeof jsonText !== 'string' || !jsonText.trim()) {
					return staticOptions;
				}

				let profilesContainer;
				try {
					profilesContainer = buildApplicationInferenceProfilesFromJson(jsonText);
				} catch (error: any) {
					// Surface the same descriptive message the node would use at execution time
					throw new Error(error?.message ?? String(error));
				}

				if (!profilesContainer?.profiles || profilesContainer.profiles.length === 0) {
					return staticOptions;
				}

				const labelByModelId: Record<string, string> = {};
				for (const option of staticOptions) {
					if (typeof option.value === 'string') {
						labelByModelId[option.value] = option.name.toString();
					}
				}

				const options: INodePropertyOptions[] = [];
				for (const profile of profilesContainer.profiles) {
					const modelId = profile.modelId?.toString().trim();
					if (!modelId) continue;

					if (options.some((option) => option.value === modelId)) {
						continue;
					}

					const name = labelByModelId[modelId] || modelId;

					options.push({
						name,
						value: modelId,
					});
				}

				if (options.length === 0) {
					return staticOptions;
				}

				return options;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				console.log(`[AWS Bedrock] Processing item ${i + 1}/${items.length}`);

				// Get credential data
				const rawCreds = await this.getCredentials('awsAssumeRole');
				console.log('[AWS Bedrock] Credentials loaded from n8n');

				const resolved = resolveBase(rawCreds);

				// Get node parameters
				const configuredModelId = this.getNodeParameter('modelId', i) as string;
				const inputType = this.getNodeParameter('inputType', i) as 'text' | 'image';
				const prompt = this.getNodeParameter('prompt', i) as string;
				const maxTokens = this.getNodeParameter('maxTokens', i) as number;
				const temperature = this.getNodeParameter('temperature', i) as number;
				const imageBinaryPropertyName =
					inputType === 'image'
						? (this.getNodeParameter('imageBinaryPropertyName', i) as string)
						: undefined;

				console.log('[AWS Bedrock] Node parameters:', {
					configuredModelId,
					inputType,
					imageBinaryPropertyName,
					promptLength: prompt.length,
					maxTokens,
					temperature,
				});

				// Resolve effective model identifier (optionally using application inference profile)
				const rawCredsRecord = rawCreds as { [key: string]: any };
				const applicationInferenceProfileAccountId =
					rawCredsRecord.applicationInferenceProfileAccountId as string | undefined;
				const applicationInferenceProfileId =
					rawCredsRecord.applicationInferenceProfileId as string | undefined;
				const applicationInferenceProfilesJson =
					rawCredsRecord.applicationInferenceProfilesJson as string | undefined;

				let applicationInferenceProfiles = rawCredsRecord.applicationInferenceProfiles as unknown;

				if (!applicationInferenceProfiles && applicationInferenceProfilesJson) {
					applicationInferenceProfiles = buildApplicationInferenceProfilesFromJson(
						applicationInferenceProfilesJson,
					);
				}

				const effectiveModelId = resolveEffectiveModelId({
					modelId: configuredModelId,
					region: resolved.region,
					applicationInferenceProfileAccountId,
					applicationInferenceProfileId,
					applicationInferenceProfiles,
				});

				console.log('[AWS Bedrock] Resolved model identifier:', {
					configuredModelId,
					effectiveModelId,
				});

				// Get temporary credentials via AssumeRole
				const tempCreds = await getCachedOrFetchCredentials(resolved);

				// Create Bedrock client with temporary credentials
				const bedrockClient = new BedrockRuntimeClient({
					region: resolved.region,
					credentials: {
						accessKeyId: tempCreds.AccessKeyId!,
						secretAccessKey: tempCreds.SecretAccessKey!,
						sessionToken: tempCreds.SessionToken!,
					},
				});

				// Prepare the request body based on the configured model
				let requestBody: any;
				// Support both inference profiles (us.anthropic.claude) and direct model IDs (anthropic.claude)
				if (configuredModelId.includes('anthropic.claude')) {
					let messageContent: any;

					if (inputType === 'image') {
						if (!imageBinaryPropertyName) {
							throw new NodeOperationError(
								this.getNode(),
								'Image binary property name must be set when input type is "Text and Image".',
							);
						}

						const item = items[i];

						if (!item.binary || !item.binary[imageBinaryPropertyName]) {
							throw new NodeOperationError(
								this.getNode(),
								`Binary property "${imageBinaryPropertyName}" with image data is missing on item.`,
							);
						}

						const binaryData = item.binary[imageBinaryPropertyName] as {
							data?: string;
							mimeType?: string;
						};

						messageContent = buildClaudeMessageContent({
							inputType,
							prompt,
							binary: {
								data: binaryData.data,
								mimeType: binaryData.mimeType,
							},
						});
					} else {
						messageContent = buildClaudeMessageContent({
							inputType: 'text',
							prompt,
						});
					}

					requestBody = {
						anthropic_version: 'bedrock-2023-05-31',
						max_tokens: maxTokens,
						messages: [
							{
								role: 'user',
								content: messageContent,
							},
						],
					};

					if (temperature !== undefined) {
						requestBody.temperature = temperature;
					}
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported model: ${configuredModelId}`,
					);
				}

				console.log('[AWS Bedrock] Invoking model:', {
					configuredModelId,
					effectiveModelId,
					requestBodyKeys: Object.keys(requestBody),
				});

				// Invoke the model
				const command = new InvokeModelCommand({
					modelId: effectiveModelId,
					body: JSON.stringify(requestBody),
					contentType: 'application/json',
					accept: 'application/json',
				});

				const response = await bedrockClient.send(command);

				// Parse the response
				const responseBody = JSON.parse(new TextDecoder().decode(response.body));

				console.log('[AWS Bedrock] Model response received:', {
					usage: responseBody.usage || 'N/A',
					contentLength: responseBody.content?.[0]?.text?.length || 0,
				});

				// Format the output
				const outputData: INodeExecutionData = {
					json: {
						modelId: effectiveModelId,
						configuredModelId,
						prompt,
						response: responseBody,
						usage: responseBody.usage,
						content:
							responseBody.content?.[0]?.text || responseBody.completion || '',
						timestamp: new Date().toISOString(),
					},
				};

				returnData.push(outputData);

			} catch (error: any) {
				console.error('[AWS Bedrock] Error processing item:', {
					itemIndex: i,
					error: error.message,
					code: error.Code || error.name,
				});

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
							itemIndex: i,
						},
					});
				} else {
					throw new NodeOperationError(this.getNode(), error.message);
				}
			}
		}

		return [returnData];
	}
}
