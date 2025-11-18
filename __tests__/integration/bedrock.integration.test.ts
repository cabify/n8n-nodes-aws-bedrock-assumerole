import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

/**
 * Integration test for AWS Bedrock with AssumeRole
 * 
 * This test verifies that the Claude 3.5 Sonnet v1 model works correctly
 * with the inference profile format.
 * 
 * Required environment variables:
 * - AWS_ACCESS_KEY_ID: Base AWS access key
 * - AWS_SECRET_ACCESS_KEY: Base AWS secret key
 * - AWS_ROLE_ARN: Role ARN to assume
 * - AWS_REGION: AWS region (default: us-east-1)
 */

describe('AWS Bedrock Integration Tests', () => {
	// Skip tests if credentials are not provided
	const hasCredentials = 
		process.env.AWS_ACCESS_KEY_ID && 
		process.env.AWS_SECRET_ACCESS_KEY && 
		process.env.AWS_ROLE_ARN;

	const skipMessage = 'Skipping integration test - AWS credentials not provided';

	// Test configuration
	const config = {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
		roleArn: process.env.AWS_ROLE_ARN || '',
		region: process.env.AWS_REGION || 'us-east-1',
	};

	// Helper function to assume role
	async function assumeRole() {
		const sts = new STSClient({
			region: config.region,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
		});

		const result = await sts.send(
			new AssumeRoleCommand({
				RoleArn: config.roleArn,
				RoleSessionName: 'n8n-bedrock-test',
				DurationSeconds: 3600,
			}),
		);

		if (!result.Credentials) {
			throw new Error('Failed to obtain temporary credentials from STS');
		}

		return result.Credentials;
	}

	// Helper function to invoke Bedrock model
	async function invokeModel(modelId: string, prompt: string) {
		const tempCreds = await assumeRole();

		const bedrockClient = new BedrockRuntimeClient({
			region: config.region,
			credentials: {
				accessKeyId: tempCreds.AccessKeyId!,
				secretAccessKey: tempCreds.SecretAccessKey!,
				sessionToken: tempCreds.SessionToken!,
			},
		});

		const requestBody = {
			anthropic_version: 'bedrock-2023-05-31',
			max_tokens: 100,
			messages: [
				{
					role: 'user',
					content: prompt,
				},
			],
		};

		const command = new InvokeModelCommand({
			modelId,
			body: JSON.stringify(requestBody),
			contentType: 'application/json',
			accept: 'application/json',
		});

		const response = await bedrockClient.send(command);
		const responseBody = JSON.parse(new TextDecoder().decode(response.body));

		return responseBody;
	}

	describe('Claude 3.5 Models with Inference Profiles', () => {
		it('should successfully invoke Claude 3.5 Sonnet v1 using inference profile', async () => {
			if (!hasCredentials) {
				console.log(skipMessage);
				return;
			}

			const modelId = 'us.anthropic.claude-3-5-sonnet-20240620-v1:0';
			const prompt = 'Say "Hello from Claude 3.5 Sonnet v1!" and nothing else.';

			const response = await invokeModel(modelId, prompt);

			// Verify response structure
			expect(response).toBeDefined();
			expect(response.content).toBeDefined();
			expect(Array.isArray(response.content)).toBe(true);
			expect(response.content.length).toBeGreaterThan(0);
			expect(response.content[0].text).toBeDefined();
			expect(typeof response.content[0].text).toBe('string');

			// Verify usage information
			expect(response.usage).toBeDefined();
			expect(response.usage.input_tokens).toBeGreaterThan(0);
			expect(response.usage.output_tokens).toBeGreaterThan(0);

			console.log('✅ Claude 3.5 Sonnet v1 test passed!');
			console.log('Model ID:', modelId);
			console.log('Response:', response.content[0].text);
			console.log('Usage:', response.usage);
		}, 30000); // 30 second timeout

		it('should successfully invoke Claude 3.5 Sonnet v2 using inference profile', async () => {
			if (!hasCredentials) {
				console.log(skipMessage);
				return;
			}

			const modelId = 'arn:aws:bedrock:us-east-1:616474819159:application-inference-profile/u3m1v4k8ffef';
			const prompt = 'Say "Hello from Claude 3.5 Sonnet v2!" and nothing else.';

			const response = await invokeModel(modelId, prompt);

			// Verify response structure
			expect(response).toBeDefined();
			expect(response.content).toBeDefined();
			expect(Array.isArray(response.content)).toBe(true);
			expect(response.content.length).toBeGreaterThan(0);
			expect(response.content[0].text).toBeDefined();
			expect(typeof response.content[0].text).toBe('string');

			// Verify usage information
			expect(response.usage).toBeDefined();
			expect(response.usage.input_tokens).toBeGreaterThan(0);
			expect(response.usage.output_tokens).toBeGreaterThan(0);

			console.log('✅ Claude 3.5 Sonnet v2 test passed!');
			console.log('Model ID:', modelId);
			console.log('Response:', response.content[0].text);
			console.log('Usage:', response.usage);
		}, 30000);

		it('should successfully invoke Claude 3.5 Haiku using inference profile', async () => {
			if (!hasCredentials) {
				console.log(skipMessage);
				return;
			}

			const modelId = 'us.anthropic.claude-3-5-haiku-20241022-v1:0/u3m1v4k8ffef';
			const prompt = 'Say "Hello from Claude 3.5 Haiku!" and nothing else.';

			const response = await invokeModel(modelId, prompt);

			// Verify response structure
			expect(response).toBeDefined();
			expect(response.content).toBeDefined();
			expect(Array.isArray(response.content)).toBe(true);
			expect(response.content.length).toBeGreaterThan(0);
			expect(response.content[0].text).toBeDefined();
			expect(typeof response.content[0].text).toBe('string');

			// Verify usage information
			expect(response.usage).toBeDefined();
			expect(response.usage.input_tokens).toBeGreaterThan(0);
			expect(response.usage.output_tokens).toBeGreaterThan(0);

			console.log('✅ Claude 3.5 Haiku test passed!');
			console.log('Model ID:', modelId);
			console.log('Response:', response.content[0].text);
			console.log('Usage:', response.usage);
		}, 30000);

		it('should handle AssumeRole correctly', async () => {
			if (!hasCredentials) {
				console.log(skipMessage);
				return;
			}

			const credentials = await assumeRole();

			expect(credentials).toBeDefined();
			expect(credentials.AccessKeyId).toBeDefined();
			expect(credentials.SecretAccessKey).toBeDefined();
			expect(credentials.SessionToken).toBeDefined();
			expect(credentials.Expiration).toBeDefined();

			// Verify expiration is in the future
			const expirationTime = new Date(credentials.Expiration!).getTime();
			const now = Date.now();
			expect(expirationTime).toBeGreaterThan(now);

			console.log('✅ AssumeRole test passed!');
			console.log('Credentials expire at:', credentials.Expiration);
		}, 30000);
	});

	describe('Error Handling', () => {
		it('should fail gracefully with invalid model ID', async () => {
			if (!hasCredentials) {
				console.log(skipMessage);
				return;
			}

			const invalidModelId = 'invalid.model.id';
			const prompt = 'Test prompt';

			await expect(invokeModel(invalidModelId, prompt)).rejects.toThrow();

			console.log('✅ Error handling test passed!');
		}, 30000);
	});
});

