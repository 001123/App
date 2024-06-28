import type {OnyxUpdate} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import * as API from '@libs/API';
import type {UpdateSageIntacctExporterParams} from '@libs/API/parameters';
import {WRITE_COMMANDS} from '@libs/API/types';
import * as ErrorUtils from '@libs/ErrorUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Connections} from '@src/types/onyx/Policy';

function prepareOnyxData(policyID: string, settingName: keyof Connections['intacct']['config']['export'], settingValue: string | null) {
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                connections: {
                    intacct: {
                        config: {
                            export: {
                                [settingName]: settingValue,
                                pendingFields: {
                                    [settingName]: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                                },
                                errorFields: {
                                    [settingName]: null,
                                },
                            },
                        },
                    },
                },
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                connections: {
                    intacct: {
                        config: {
                            export: {
                                [settingName]: settingValue,
                                pendingFields: {
                                    [settingName]: null,
                                },
                                errorFields: {
                                    [settingName]: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage'),
                                },
                            },
                        },
                    },
                },
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                connections: {
                    intacct: {
                        config: {
                            export: {
                                [settingName]: settingValue,
                                pendingFields: {
                                    [settingName]: null,
                                },
                                errorFields: {
                                    [settingName]: null,
                                },
                            },
                        },
                    },
                },
            },
        },
    ];

    return {optimisticData, failureData, successData};
}

function prepareParametersForExport(policyID: string, settingName: keyof Connections['intacct']['config']['export'], settingValue: string | null) {
    return {
        policyID,
        connectionName: CONST.POLICY.CONNECTIONS.NAME.SAGE_INTACCT,
        settingName: CONST.SAGE_INTACCT_CONFIG.EXPORT,
        settingValue: JSON.stringify({[settingName]: settingValue}),
        idempotencyKey: CONST.SAGE_INTACCT_CONFIG.EXPORT,
    };
}

function updateSageIntacctExport(policyID: string, settingName: keyof Connections['intacct']['config']['export'], settingValue: string | null) {
    const {optimisticData, failureData, successData} = prepareOnyxData(policyID, settingName, settingValue);
    const parameters = prepareParametersForExport(policyID, settingName, settingValue);

    API.write(WRITE_COMMANDS.UPDATE_POLICY_CONNECTION_CONFIG, parameters, {optimisticData, failureData, successData});
}

function updateSageIntacctExporter(policyID: string, exporter: string) {
    const {optimisticData, failureData, successData} = prepareOnyxData(policyID, CONST.SAGE_INTACCT_CONFIG.EXPORTER, exporter);
    const parameters: UpdateSageIntacctExporterParams = {
        policyID,
        email: exporter,
    };

    API.write(WRITE_COMMANDS.UPDATE_SAGE_INTACCT_EXPORTER, parameters, {optimisticData, failureData, successData});
}

function updateSageIntacctExportDate(policyID: string, date: ValueOf<typeof CONST.SAGE_INTACCT_EXPORT_DATE>) {
    updateSageIntacctExport(policyID, CONST.SAGE_INTACCT_CONFIG.EXPORT_DATE, date);
}

function updateSageIntacctExportReimbursableExpense(policyID: string, reimbursable: ValueOf<typeof CONST.SAGE_INTACCT_REIMBURSABLE_EXPENSE_TYPE>) {
    updateSageIntacctExport(policyID, CONST.SAGE_INTACCT_CONFIG.REIMBURSABLE, reimbursable);
}

function updateSageIntacctDefaultVendor(policyID: string, settingName: keyof Connections['intacct']['config']['export'], settingValue: string | null) {
    updateSageIntacctExport(policyID, settingName, settingValue);
}

function updateSageIntacctExportNonReimbursableExpense(policyID: string, nonReimbursable: ValueOf<typeof CONST.SAGE_INTACCT_NON_REIMBURSABLE_EXPENSE_TYPE>) {
    updateSageIntacctExport(policyID, CONST.SAGE_INTACCT_CONFIG.NON_REIMBURSABLE, nonReimbursable);
}

function updateSageIntacctExportNonReimbursableAccount(policyID: string, nonReimbursableAccount: string) {
    updateSageIntacctExport(policyID, CONST.SAGE_INTACCT_CONFIG.NON_REIMBURSABLE_ACCOUNT, nonReimbursableAccount);
}

export {
    updateSageIntacctExporter,
    updateSageIntacctExportDate,
    updateSageIntacctExportReimbursableExpense,
    updateSageIntacctDefaultVendor,
    updateSageIntacctExportNonReimbursableExpense,
    updateSageIntacctExportNonReimbursableAccount,
};
