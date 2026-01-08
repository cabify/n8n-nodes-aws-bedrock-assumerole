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


// Image generation model IDs
const IMAGE_GENERATION_MODELS = [
	'amazon.nova-canvas-v1:0',
	'amazon.titan-image-generator-v2:0',
];

// Check if a model ID is an image generation model
export function isImageGenerationModel(modelId: string): boolean {
	return IMAGE_GENERATION_MODELS.some((id) => modelId.includes(id));
}

// Build request body for image generation models (Nova Canvas, Titan Image)
export function buildImageGenerationRequestBody(args: {
	modelId: string;
	prompt: string;
	negativePrompt?: string;
	width: number;
	height: number;
	quality: 'standard' | 'premium';
	numberOfImages: number;
	seed?: number;
	cfgScale?: number;
}): Record<string, unknown> {
	const requestBody: Record<string, unknown> = {
		taskType: 'TEXT_IMAGE',
		textToImageParams: {
			text: args.prompt,
		} as Record<string, unknown>,
		imageGenerationConfig: {
			width: args.width,
			height: args.height,
			quality: args.quality,
			numberOfImages: args.numberOfImages,
		} as Record<string, unknown>,
	};

	// Add negative prompt if provided
	if (args.negativePrompt && args.negativePrompt.trim()) {
		(requestBody.textToImageParams as Record<string, unknown>).negativeText = args.negativePrompt.trim();
	}

	// Add seed if provided and not 0 (0 means random)
	if (args.seed && args.seed > 0) {
		(requestBody.imageGenerationConfig as Record<string, unknown>).seed = args.seed;
	} else {
		// Generate random seed for reproducibility logging
		(requestBody.imageGenerationConfig as Record<string, unknown>).seed = Math.floor(Math.random() * 858993460);
	}

	// Add cfgScale for Titan Image models
	if (args.modelId.includes('titan-image') && args.cfgScale !== undefined) {
		(requestBody.imageGenerationConfig as Record<string, unknown>).cfgScale = args.cfgScale;
	}

	return requestBody;
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
			// ===== Text/Chat Model Fields (Claude) =====
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
				displayOptions: {
					hide: {
						modelId: [
							'amazon.nova-canvas-v1:0',
							'amazon.titan-image-generator-v2:0',
						],
					},
				},
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
					hide: {
						modelId: [
							'amazon.nova-canvas-v1:0',
							'amazon.titan-image-generator-v2:0',
						],
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
				displayOptions: {
					hide: {
						modelId: [
							'amazon.nova-canvas-v1:0',
							'amazon.titan-image-generator-v2:0',
						],
					},
				},
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
				displayOptions: {
					hide: {
						modelId: [
							'amazon.nova-canvas-v1:0',
							'amazon.titan-image-generator-v2:0',
						],
					},
				},
			},
			// ===== Image Generation Model Fields (Nova Canvas, Titan Image) =====
			{
				displayName: 'Negative Prompt',
				name: 'negativePrompt',
				type: 'string',
				typeOptions: {
					rows: 2,
				},
				default: '',
				required: false,
				description: 'Text describing what NOT to include in the generated image (max 512 characters)',
				displayOptions: {
					show: {
						modelId: [
							'amazon.nova-canvas-v1:0',
							'amazon.titan-image-generator-v2:0',
						],
					},
				},
			},
			{
				displayName: 'Image Width',
				name: 'imageWidth',
				type: 'options',
				options: [
					{ name: '512', value: 512 },
					{ name: '768', value: 768 },
					{ name: '1024', value: 1024 },
					{ name: '1280', value: 1280 },
				],
				default: 1024,
				required: true,
				description: 'Width of the generated image in pixels',
				displayOptions: {
					show: {
						modelId: [
							'amazon.nova-canvas-v1:0',
							'amazon.titan-image-generator-v2:0',
						],
					},
				},
			},
			{
				displayName: 'Image Height',
				name: 'imageHeight',
				type: 'options',
				options: [
					{ name: '512', value: 512 },
					{ name: '768', value: 768 },
					{ name: '1024', value: 1024 },
					{ name: '1280', value: 1280 },
				],
				default: 1024,
				required: true,
				description: 'Height of the generated image in pixels',
				displayOptions: {
					show: {
						modelId: [
							'amazon.nova-canvas-v1:0',
							'amazon.titan-image-generator-v2:0',
						],
					},
				},
			},
			{
				displayName: 'Image Quality',
				name: 'imageQuality',
				type: 'options',
				options: [
					{ name: 'Standard', value: 'standard' },
					{ name: 'Premium', value: 'premium' },
				],
				default: 'standard',
				required: true,
				description: 'Quality of the generated image',
				displayOptions: {
					show: {
						modelId: [
							'amazon.nova-canvas-v1:0',
							'amazon.titan-image-generator-v2:0',
						],
					},
				},
			},
			{
				displayName: 'Number of Images',
				name: 'numberOfImages',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 4,
				},
				default: 1,
				required: true,
				description: 'Number of images to generate (1-4)',
				displayOptions: {
					show: {
						modelId: [
							'amazon.nova-canvas-v1:0',
							'amazon.titan-image-generator-v2:0',
						],
					},
				},
			},
			{
				displayName: 'Seed',
				name: 'imageSeed',
				type: 'number',
				default: 0,
				required: false,
				description: 'Seed for reproducible image generation (0 for random). Range: 0 to 858993459.',
				displayOptions: {
					show: {
						modelId: [
							'amazon.nova-canvas-v1:0',
							'amazon.titan-image-generator-v2:0',
						],
					},
				},
			},
			{
				displayName: 'CFG Scale',
				name: 'cfgScale',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 15,
					numberStepSize: 0.5,
				},
				default: 8.0,
				required: false,
				description: 'How closely the image follows the prompt (1-15). Higher values = more literal interpretation.',
				displayOptions: {
					show: {
						modelId: [
							'amazon.titan-image-generator-v2:0',
						],
					},
				},
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
					{
						name: 'Amazon Nova Canvas v1 (Image Generation)',
						value: 'amazon.nova-canvas-v1:0',
					},
					{
						name: 'Amazon Titan Image Generator v2',
						value: 'amazon.titan-image-generator-v2:0',
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
				const prompt = this.getNodeParameter('prompt', i) as string;
				const isImageModel = isImageGenerationModel(configuredModelId);

				// Get parameters based on model type
				let inputType: 'text' | 'image' = 'text';
				let maxTokens = 1000;
				let temperature = 0.7;
				let imageBinaryPropertyName: string | undefined;

				// Image generation parameters
				let imageWidth = 1024;
				let imageHeight = 1024;
				let imageQuality: 'standard' | 'premium' = 'standard';
				let numberOfImages = 1;
				let imageSeed = 0;
				let negativePrompt = '';
				let cfgScale = 8.0;

				if (isImageModel) {
					// Get image generation parameters
					imageWidth = this.getNodeParameter('imageWidth', i) as number;
					imageHeight = this.getNodeParameter('imageHeight', i) as number;
					imageQuality = this.getNodeParameter('imageQuality', i) as 'standard' | 'premium';
					numberOfImages = this.getNodeParameter('numberOfImages', i) as number;
					imageSeed = this.getNodeParameter('imageSeed', i, 0) as number;
					negativePrompt = this.getNodeParameter('negativePrompt', i, '') as string;
					if (configuredModelId.includes('titan-image')) {
						cfgScale = this.getNodeParameter('cfgScale', i, 8.0) as number;
					}

					console.log('[AWS Bedrock] Image generation parameters:', {
						configuredModelId,
						promptLength: prompt.length,
						imageWidth,
						imageHeight,
						imageQuality,
						numberOfImages,
						imageSeed,
						negativePromptLength: negativePrompt.length,
						cfgScale,
					});
				} else {
					// Get text/chat model parameters
					inputType = this.getNodeParameter('inputType', i) as 'text' | 'image';
					maxTokens = this.getNodeParameter('maxTokens', i) as number;
					temperature = this.getNodeParameter('temperature', i) as number;
					imageBinaryPropertyName =
						inputType === 'image'
							? (this.getNodeParameter('imageBinaryPropertyName', i) as string)
							: undefined;

					console.log('[AWS Bedrock] Text model parameters:', {
						configuredModelId,
						inputType,
						imageBinaryPropertyName,
						promptLength: prompt.length,
						maxTokens,
						temperature,
					});
				}

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

				if (isImageModel) {
					// Build request body for image generation models
					requestBody = buildImageGenerationRequestBody({
						modelId: configuredModelId,
						prompt,
						negativePrompt,
						width: imageWidth,
						height: imageHeight,
						quality: imageQuality,
						numberOfImages,
						seed: imageSeed,
						cfgScale,
					});
				} else if (configuredModelId.includes('anthropic.claude')) {
					// Build request body for Claude models
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

				// Handle response based on model type
				if (isImageModel) {
					// Image generation response
					const images = responseBody.images as string[] | undefined;

					console.log('[AWS Bedrock] Image generation response received:', {
						numberOfImages: images?.length || 0,
						error: responseBody.error || null,
					});

					if (responseBody.error) {
						throw new NodeOperationError(
							this.getNode(),
							`Image generation failed: ${responseBody.error}`,
						);
					}

					if (!images || images.length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'No images were generated by the model.',
						);
					}

					// Create output for each generated image
					for (let imgIndex = 0; imgIndex < images.length; imgIndex++) {
						const base64Image = images[imgIndex];
						const binaryData = Buffer.from(base64Image, 'base64');

						const outputData: INodeExecutionData = {
							json: {
								modelId: effectiveModelId,
								configuredModelId,
								prompt,
								imageIndex: imgIndex,
								totalImages: images.length,
								imageWidth,
								imageHeight,
								imageQuality,
								timestamp: new Date().toISOString(),
							},
							binary: {
								data: {
									data: base64Image,
									mimeType: 'image/png',
									fileName: `generated-image-${imgIndex + 1}.png`,
									fileSize: binaryData.length.toString(),
									fileExtension: 'png',
								},
							},
						};

						returnData.push(outputData);
					}
				} else {
					// Text/chat model response (Claude)
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
				}

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
