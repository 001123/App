import Config from 'react-native-config';
import CONST from '../../CONST';
import getEnvironment from './getEnvironment';
import CONFIG from '../../CONFIG';

const ENVIRONMENT_URLS = {
    [CONST.ENVIRONMENT.DEV]: CONST.DEV_NEW_EXPENSIFY_URL + CONFIG.DEV_PORT,
    [CONST.ENVIRONMENT.STAGING]: CONST.STAGING_NEW_EXPENSIFY_URL,
    [CONST.ENVIRONMENT.PRODUCTION]: CONST.NEW_EXPENSIFY_URL,
    [CONST.ENVIRONMENT.ADHOC]: CONST.STAGING_NEW_EXPENSIFY_URL,
};

const OLDDOT_ENVIRONMENT_URLS = {
    [CONST.ENVIRONMENT.DEV]: CONST.INTERNAL_DEV_EXPENSIFY_URL,
    [CONST.ENVIRONMENT.STAGING]: CONST.STAGING_EXPENSIFY_URL,
    [CONST.ENVIRONMENT.PRODUCTION]: CONST.EXPENSIFY_URL,
    [CONST.ENVIRONMENT.ADHOC]: CONST.STAGING_EXPENSIFY_URL,
};

type EnvironmentUrlsKeys = keyof typeof ENVIRONMENT_URLS;
type OldDotEnvironmentUrlsKeys = keyof typeof OLDDOT_ENVIRONMENT_URLS;

/**
 * Are we running the app in development?
 */
function isDevelopment(): boolean {
    return (Config?.ENVIRONMENT ?? CONST.ENVIRONMENT.DEV) === CONST.ENVIRONMENT.DEV;
}

/**
 * Are we running an internal test build?
 */
function isInternalTestBuild(): boolean {
    return !!((Config?.ENVIRONMENT ?? CONST.ENVIRONMENT.DEV) === CONST.ENVIRONMENT.ADHOC && (Config?.PULL_REQUEST_NUMBER ?? ''));
}

/**
 * Get the URL based on the environment we are in
 */
function getEnvironmentURL(): Promise<string> {
    return new Promise((resolve) => {
        getEnvironment().then((environment) => resolve(ENVIRONMENT_URLS[environment as EnvironmentUrlsKeys]));
    });
}

/**
 * Get the corresponding oldDot URL based on the environment we are in
 */
function getOldDotEnvironmentURL(): Promise<string> {
    return getEnvironment().then((environment) => OLDDOT_ENVIRONMENT_URLS[environment as OldDotEnvironmentUrlsKeys]);
}

export {getEnvironment, isInternalTestBuild, isDevelopment, getEnvironmentURL, getOldDotEnvironmentURL};
