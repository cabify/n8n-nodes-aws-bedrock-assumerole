import {
	buildApplicationInferenceProfilesFromJson,
	buildClaudeMessageContent,
	buildImageGenerationRequestBody,
	isImageGenerationModel,
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

describe('isImageGenerationModel', () => {
	it('returns true for Nova Canvas model', () => {
		expect(isImageGenerationModel('amazon.nova-canvas-v1:0')).toBe(true);
	});

	it('returns true for Titan Image Generator model', () => {
		expect(isImageGenerationModel('amazon.titan-image-generator-v2:0')).toBe(true);
	});

	it('returns false for Claude models', () => {
		expect(isImageGenerationModel('us.anthropic.claude-3-5-sonnet-20241022-v2:0')).toBe(false);
		expect(isImageGenerationModel('anthropic.claude-3-5-haiku-20241022-v1:0')).toBe(false);
	});

	it('returns false for unknown models', () => {
		expect(isImageGenerationModel('some-other-model')).toBe(false);
	});
});

describe('buildImageGenerationRequestBody', () => {
	// TEXT_IMAGE tests
	it('builds basic TEXT_IMAGE request body for Nova Canvas', () => {
		const result = buildImageGenerationRequestBody({
			modelId: 'amazon.nova-canvas-v1:0',
			taskType: 'TEXT_IMAGE',
			prompt: 'A beautiful sunset over mountains',
			width: 1024,
			height: 1024,
			quality: 'standard',
			numberOfImages: 1,
		});

		expect(result.taskType).toBe('TEXT_IMAGE');
		expect(result.textToImageParams).toEqual({
			text: 'A beautiful sunset over mountains',
		});
		expect((result.imageGenerationConfig as any).width).toBe(1024);
		expect((result.imageGenerationConfig as any).height).toBe(1024);
		expect((result.imageGenerationConfig as any).quality).toBe('standard');
		expect((result.imageGenerationConfig as any).numberOfImages).toBe(1);
		// Should have a random seed when not provided
		expect((result.imageGenerationConfig as any).seed).toBeDefined();
	});

	it('includes negative prompt when provided for TEXT_IMAGE', () => {
		const result = buildImageGenerationRequestBody({
			modelId: 'amazon.titan-image-generator-v2:0',
			taskType: 'TEXT_IMAGE',
			prompt: 'A cat',
			negativePrompt: 'blurry, low quality',
			width: 512,
			height: 512,
			quality: 'premium',
			numberOfImages: 2,
		});

		expect((result.textToImageParams as any).text).toBe('A cat');
		expect((result.textToImageParams as any).negativeText).toBe('blurry, low quality');
	});

	it('uses provided seed when greater than 0', () => {
		const result = buildImageGenerationRequestBody({
			modelId: 'amazon.nova-canvas-v1:0',
			taskType: 'TEXT_IMAGE',
			prompt: 'Test prompt',
			width: 512,
			height: 512,
			quality: 'standard',
			numberOfImages: 1,
			seed: 12345,
		});

		expect((result.imageGenerationConfig as any).seed).toBe(12345);
	});

	it('generates random seed when seed is 0', () => {
		const result = buildImageGenerationRequestBody({
			modelId: 'amazon.nova-canvas-v1:0',
			taskType: 'TEXT_IMAGE',
			prompt: 'Test prompt',
			width: 512,
			height: 512,
			quality: 'standard',
			numberOfImages: 1,
			seed: 0,
		});

		const seed = (result.imageGenerationConfig as any).seed;
		expect(seed).toBeGreaterThanOrEqual(0);
		expect(seed).toBeLessThan(858993460);
	});

	it('includes cfgScale for Titan Image models', () => {
		const result = buildImageGenerationRequestBody({
			modelId: 'amazon.titan-image-generator-v2:0',
			taskType: 'TEXT_IMAGE',
			prompt: 'Test prompt',
			width: 1024,
			height: 1024,
			quality: 'standard',
			numberOfImages: 1,
			cfgScale: 10.5,
		});

		expect((result.imageGenerationConfig as any).cfgScale).toBe(10.5);
	});

	it('does not include cfgScale for Nova Canvas models', () => {
		const result = buildImageGenerationRequestBody({
			modelId: 'amazon.nova-canvas-v1:0',
			taskType: 'TEXT_IMAGE',
			prompt: 'Test prompt',
			width: 1024,
			height: 1024,
			quality: 'standard',
			numberOfImages: 1,
			cfgScale: 10.5,
		});

		expect((result.imageGenerationConfig as any).cfgScale).toBeUndefined();
	});

	it('does not include empty negative prompt', () => {
		const result = buildImageGenerationRequestBody({
			modelId: 'amazon.nova-canvas-v1:0',
			taskType: 'TEXT_IMAGE',
			prompt: 'Test prompt',
			negativePrompt: '   ',
			width: 512,
			height: 512,
			quality: 'standard',
			numberOfImages: 1,
		});

		expect((result.textToImageParams as any).negativeText).toBeUndefined();
	});

	// INPAINTING tests
	it('builds INPAINTING request body with maskPrompt', () => {
		const result = buildImageGenerationRequestBody({
			modelId: 'amazon.nova-canvas-v1:0',
			taskType: 'INPAINTING',
			prompt: 'Add a red hat',
			sourceImageBase64: 'base64-source-image',
			maskPrompt: 'the head',
			width: 1024,
			height: 1024,
			quality: 'standard',
			numberOfImages: 1,
		});

		expect(result.taskType).toBe('INPAINTING');
		expect((result.inPaintingParams as any).image).toBe('base64-source-image');
		expect((result.inPaintingParams as any).text).toBe('Add a red hat');
		expect((result.inPaintingParams as any).maskPrompt).toBe('the head');
		expect((result.inPaintingParams as any).maskImage).toBeUndefined();
	});

	it('builds INPAINTING request body with maskImage', () => {
		const result = buildImageGenerationRequestBody({
			modelId: 'amazon.titan-image-generator-v2:0',
			taskType: 'INPAINTING',
			prompt: 'Replace with flowers',
			sourceImageBase64: 'base64-source-image',
			maskImageBase64: 'base64-mask-image',
			negativePrompt: 'blurry',
			width: 512,
			height: 512,
			quality: 'premium',
			numberOfImages: 1,
		});

		expect(result.taskType).toBe('INPAINTING');
		expect((result.inPaintingParams as any).maskImage).toBe('base64-mask-image');
		expect((result.inPaintingParams as any).maskPrompt).toBeUndefined();
		expect((result.inPaintingParams as any).negativeText).toBe('blurry');
	});

	// OUTPAINTING tests
	it('builds OUTPAINTING request body with outpaintingMode', () => {
		const result = buildImageGenerationRequestBody({
			modelId: 'amazon.nova-canvas-v1:0',
			taskType: 'OUTPAINTING',
			prompt: 'Extend the beach',
			sourceImageBase64: 'base64-source-image',
			maskPrompt: 'the sky',
			outpaintingMode: 'PRECISE',
			width: 1024,
			height: 1024,
			quality: 'standard',
			numberOfImages: 1,
		});

		expect(result.taskType).toBe('OUTPAINTING');
		expect((result.outPaintingParams as any).image).toBe('base64-source-image');
		expect((result.outPaintingParams as any).text).toBe('Extend the beach');
		expect((result.outPaintingParams as any).maskPrompt).toBe('the sky');
		expect((result.outPaintingParams as any).outPaintingMode).toBe('PRECISE');
	});

	// IMAGE_VARIATION tests
	it('builds IMAGE_VARIATION request body with similarityStrength', () => {
		const result = buildImageGenerationRequestBody({
			modelId: 'amazon.titan-image-generator-v2:0',
			taskType: 'IMAGE_VARIATION',
			prompt: 'Make it more colorful',
			sourceImageBase64: 'base64-source-image',
			similarityStrength: 0.5,
			width: 1024,
			height: 1024,
			quality: 'standard',
			numberOfImages: 2,
		});

		expect(result.taskType).toBe('IMAGE_VARIATION');
		expect((result.imageVariationParams as any).images).toEqual(['base64-source-image']);
		expect((result.imageVariationParams as any).text).toBe('Make it more colorful');
		expect((result.imageVariationParams as any).similarityStrength).toBe(0.5);
	});

	// BACKGROUND_REMOVAL tests
	it('builds BACKGROUND_REMOVAL request body', () => {
		const result = buildImageGenerationRequestBody({
			modelId: 'amazon.nova-canvas-v1:0',
			taskType: 'BACKGROUND_REMOVAL',
			prompt: '', // Not used for background removal
			sourceImageBase64: 'base64-source-image',
			width: 1024,
			height: 1024,
			quality: 'standard',
			numberOfImages: 1,
		});

		expect(result.taskType).toBe('BACKGROUND_REMOVAL');
		expect((result.backgroundRemovalParams as any).image).toBe('base64-source-image');
		// Background removal should not have imageGenerationConfig
		expect(result.imageGenerationConfig).toBeUndefined();
	});

	it('throws error for unsupported task type', () => {
		expect(() =>
			buildImageGenerationRequestBody({
				modelId: 'amazon.nova-canvas-v1:0',
				taskType: 'INVALID_TASK' as any,
				prompt: 'Test',
				width: 1024,
				height: 1024,
				quality: 'standard',
				numberOfImages: 1,
			}),
		).toThrow('Unsupported image task type: INVALID_TASK');
	});
});

