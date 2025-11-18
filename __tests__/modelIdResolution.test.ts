import {
	buildApplicationInferenceProfilesFromJson,
	buildClaudeMessageContent,
	resolveEffectiveModelId,
} from '../nodes/AwsBedrockAssumeRole.node';

describe('resolveEffectiveModelId', () => {
	it('returns base modelId when application inference profile details are not provided', () => {
		const result = resolveEffectiveModelId({
			modelId: 'us.anthropic.claude-3-5-sonnet-20240620-v1:0',
			region: 'us-east-1',
		});

		expect(result).toBe('us.anthropic.claude-3-5-sonnet-20240620-v1:0');
	});

	it('builds application inference profile ARN when per-model configuration is provided', () => {
		const result = resolveEffectiveModelId({
			modelId: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
			region: 'us-east-1',
			applicationInferenceProfileAccountId: '616474819159',
			applicationInferenceProfiles: {
				profiles: [
					{
						modelId: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
						profileId: '0xumpou8xusv',
					},
				],
			},
		});

		expect(result).toBe(
			'arn:aws:bedrock:us-east-1:616474819159:application-inference-profile/0xumpou8xusv',
		);
	});

	it('trims whitespace in account and profile identifiers from per-model configuration', () => {
		const result = resolveEffectiveModelId({
			modelId: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
			region: 'us-east-1',
			applicationInferenceProfileAccountId: ' 616474819159 ',
			applicationInferenceProfiles: {
				profiles: [
					{
						modelId: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
						profileId: ' hs4uvikaus5b ',
					},
				],
			},
		});

		expect(result).toBe(
			'arn:aws:bedrock:us-east-1:616474819159:application-inference-profile/hs4uvikaus5b',
		);
	});

	it('falls back to legacy single profile id when no per-model profile is configured', () => {
		const result = resolveEffectiveModelId({
			modelId: 'us.anthropic.claude-3-5-sonnet-20240620-v1:0',
			region: 'us-east-1',
			applicationInferenceProfileAccountId: '616474819159',
			applicationInferenceProfileId: 'hs4uvikaus5b',
			applicationInferenceProfiles: {
				profiles: [
					{
						modelId: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
						profileId: 'ignored-profile-id',
					},
				],
			},
		});

		expect(result).toBe(
			'arn:aws:bedrock:us-east-1:616474819159:application-inference-profile/hs4uvikaus5b',
		);
	});
});

describe('buildApplicationInferenceProfilesFromJson', () => {
	it('returns undefined for empty or whitespace-only JSON', () => {
		expect(buildApplicationInferenceProfilesFromJson('')).toBeUndefined();
		expect(buildApplicationInferenceProfilesFromJson('   ')).toBeUndefined();
	});

	it('builds profiles container from valid mapping JSON', () => {
		const json = JSON.stringify({
			'us.anthropic.claude-3-5-sonnet-20241022-v2:0': '0xumpou8xusv',
			'us.anthropic.claude-3-5-haiku-20241022-v1:0': 'hs4uvikaus5b',
		});

		const result = buildApplicationInferenceProfilesFromJson(json);

		expect(result).toEqual({
			profiles: [
				{
					modelId: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
					profileId: '0xumpou8xusv',
				},
				{
					modelId: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
					profileId: 'hs4uvikaus5b',
				},
			],
		});
	});

	it('throws a descriptive error for invalid JSON', () => {
		expect(() => buildApplicationInferenceProfilesFromJson('not-json')).toThrow(
			'Invalid JSON in "Application Inference Profiles JSON" credential field',
		);
	});
});

describe('buildClaudeMessageContent', () => {
		it('returns plain prompt for text input type', () => {
			const result = buildClaudeMessageContent({
				inputType: 'text',
				prompt: 'Hello from text',
			});

			expect(result).toBe('Hello from text');
		});

		it('builds multimodal content array for image input type', () => {
			const result = buildClaudeMessageContent({
				inputType: 'image',
				prompt: 'Describe the image',
				binary: {
					data: 'base64-image-data',
					mimeType: 'image/jpeg',
				},
			});

			expect(Array.isArray(result)).toBe(true);
			const blocks = result as any[];

			expect(blocks[0]).toEqual({
				type: 'image',
				source: {
					type: 'base64',
					media_type: 'image/jpeg',
					data: 'base64-image-data',
				},
			});

			expect(blocks[1]).toEqual({
				type: 'text',
				text: 'Describe the image',
			});
		});

		it('throws when binary data is missing for image input type', () => {
			expect(() =>
				buildClaudeMessageContent({
					inputType: 'image',
					prompt: 'Describe the image',
				}),
			).toThrow('Missing binary image data for image input.');
		});
	});

