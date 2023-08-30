/**
 * @jest-environment node
 */
const core = require('@actions/core');
const GitUtils = require('../../.github/libs/GitUtils');
const GithubUtils = require('../../.github/libs/GithubUtils');
const run = require('../../.github/actions/javascript/markPullRequestsAsDeployed/markPullRequestsAsDeployed');

const mockGetInput = jest.fn();
const mockListIssues = jest.fn();
const mockListEvents = jest.fn();
const mockCreateComment = jest.fn();
const mockGetPullRequestsMergedBetween = jest.fn();
let workflowRunURL;

const PRList = [1, 2, 3, 4];

/**
 * @param {String} key
 * @returns {Boolean|String}
 * @throws {Error}
 */
function defaultMockGetInput(key) {
    switch (key) {
        case 'PR_LIST':
            return JSON.stringify(PRList);
        case 'IS_PRODUCTION_DEPLOY':
            return false;
        case 'DEPLOY_VERSION':
            return '42.42.42-42';
        case 'IOS':
        case 'ANDROID':
        case 'DESKTOP':
        case 'WEB':
            return 'success';
        default:
            throw new Error('Trying to access invalid input');
    }
}

/**
 * @returns {Promise<[{actor: {login: string}, event: string}]>}
 */
async function defaultMockListEvents() {
    return [{event: 'closed', actor: {login: 'thor'}}];
}

beforeAll(() => {
    // Mock core module
    core.getInput = mockGetInput;
    mockGetInput.mockImplementation(defaultMockGetInput);

    // Mock octokit module
    const moctokit = {
        rest: {
            issues: {
                listForRepo: jest.fn().mockImplementation(async () => ({
                    data: [
                        {
                            number: 5,
                        },
                    ],
                })),
                listEvents: mockListEvents,
                createComment: mockCreateComment,
            },
            pulls: {
                // Static mock for pulls.list (only used to filter out automated PRs, and that functionality is covered
                // in the test for GithubUtils.generateStagingDeployCashBody
                list: jest.fn().mockResolvedValue([]),
            },
        },
        paginate: jest.fn().mockImplementation((objectMethod) => objectMethod().then(({data}) => data)),
    };
    GithubUtils.internalOctokit = moctokit;

    // Mock GitUtils
    GitUtils.getPullRequestsMergedBetween = mockGetPullRequestsMergedBetween;

    // Set GH runner environment variables
    process.env.GITHUB_SERVER_URL = 'https://github.com';
    process.env.GITHUB_REPOSITORY = 'Expensify/App';
    process.env.GITHUB_RUN_ID = 1234;
    workflowRunURL = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
});

afterEach(() => {
    mockGetInput.mockClear();
    mockListIssues.mockClear();
    mockGetPullRequestsMergedBetween.mockClear();
});

afterAll(() => {
    jest.clearAllMocks();
});

describe('markPullRequestsAsDeployed', () => {
    it('comments on pull requests correctly for a standard staging deploy', async () => {});

    it('comments on pull requests correctly for a standard production deploy', async () => {
        mockGetInput.mockImplementation((key) => {
            if (key === 'IS_PRODUCTION_DEPLOY') {
                return true;
            }
            return defaultMockGetInput(key);
        });

        await run();
        expect(mockCreateComment).toHaveBeenCalledTimes(PRList.length);
        expect(mockCreateComment).toHaveBeenNthCalledWith(`🚀 [Deployed](${workflowRunURL}) to production `);
    });

    it('comments on pull requests correctly for a cherry pick', async () => {});

    it('comments on pull requests correctly when one platform fails', async () => {
        mockGetInput.mockImplementation((key) => {
            if (key === 'ANDROID') {
                return 'skipped';
            }
            if (key === 'IOS') {
                return 'failed';
            }
            if (key === 'DESKTOP') {
                return 'cancelled';
            }
            return defaultMockGetInput(key);
        });
    });
});
