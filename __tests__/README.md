# Integration Tests

This directory contains integration tests for the AWS Bedrock node.

## Setup

1. Copy the `.env.test.example` file to `.env.test` in the project root:
   ```bash
   cp .env.test.example .env.test
   ```

2. Fill in your AWS credentials in `.env.test`:
   ```bash
   # Base AWS credentials (for AssumeRole)
   AWS_ACCESS_KEY_ID=your-base-access-key-id
   AWS_SECRET_ACCESS_KEY=your-base-secret-access-key

   # Role ARN to assume
   AWS_ROLE_ARN=arn:aws:iam::123456789012:role/your-bedrock-role

   # AWS Region
   AWS_REGION=us-east-1
   ```

## Running Tests

### Run all tests
```bash
npm test
```

### Run only integration tests
```bash
npm run test:integration
```

### Run a specific test file
```bash
npx jest __tests__/integration/bedrock.integration.test.ts
```

### Run tests with verbose output
```bash
npm test -- --verbose
```

## Test Coverage

The integration tests verify:

1. **Claude 3.5 Sonnet v1 with Inference Profile**
   - Tests that the model can be invoked successfully using the inference profile format (`us.anthropic.claude-3-5-sonnet-20240620-v1:0`)
   - Verifies the response structure and content
   - Checks usage information (input/output tokens)

2. **AssumeRole Authentication**
   - Tests that temporary credentials can be obtained via AssumeRole
   - Verifies credential expiration is in the future

3. **Error Handling**
   - Tests that invalid model IDs fail gracefully

## Notes

- Tests will be skipped if AWS credentials are not provided
- Each test has a 30-second timeout to account for network latency
- Tests use real AWS resources and may incur small costs
- Make sure your AWS role has the necessary permissions for Bedrock

## Troubleshooting

### Tests are skipped
- Make sure you've created the `.env.test` file with valid credentials
- Verify that all required environment variables are set

### AssumeRole fails
- Check that your base AWS credentials have `sts:AssumeRole` permission
- Verify the Role ARN is correct
- Ensure the target role trusts your base account/role

### Model invocation fails
- Verify the assumed role has `bedrock:InvokeModel` permission
- Check that the model is available in your AWS region
- Ensure Bedrock is enabled in your AWS account

