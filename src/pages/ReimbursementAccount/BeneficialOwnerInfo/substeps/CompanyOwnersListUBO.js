import PropTypes from 'prop-types';
import React from 'react';
import {ScrollView, View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import _ from 'underscore';
import Button from '@components/Button';
import DotIndicatorMessage from '@components/DotIndicatorMessage';
import * as Expensicons from '@components/Icon/Expensicons';
import MenuItem from '@components/MenuItem';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import * as ErrorUtils from '@libs/ErrorUtils';
import reimbursementAccountDraftPropTypes from '@pages/ReimbursementAccount/ReimbursementAccountDraftPropTypes';
import {reimbursementAccountPropTypes} from '@pages/ReimbursementAccount/reimbursementAccountPropTypes';
import * as ReimbursementAccountProps from '@pages/ReimbursementAccount/reimbursementAccountPropTypes';
import getDefaultValueForReimbursementAccountField from '@pages/ReimbursementAccount/utils/getDefaultValueForReimbursementAccountField';
import getSubstepValues from '@pages/ReimbursementAccount/utils/getSubstepValues';
import getValuesForBeneficialOwner from '@pages/ReimbursementAccount/utils/getValuesForBeneficialOwner';
import styles from '@styles/styles';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

const propTypes = {
    /** Method called when user confirms data */
    handleUBOsConfirmation: PropTypes.func.isRequired,

    /** Method called when user presses on one of UBOs to edit its data */
    handleUBOEdit: PropTypes.func.isRequired,

    /** List of UBOs IDs */
    beneficialOwners: PropTypes.arrayOf(PropTypes.string).isRequired,

    /** Info is user UBO */
    isUserUBO: PropTypes.bool.isRequired,

    /** Info about other existing UBOs */
    isAnyoneElseUBO: PropTypes.bool.isRequired,

    /** Reimbursement account from ONYX */
    reimbursementAccount: reimbursementAccountPropTypes,

    /** The draft values of the bank account being setup */
    reimbursementAccountDraft: reimbursementAccountDraftPropTypes,
};

const defaultProps = {
    reimbursementAccount: ReimbursementAccountProps.reimbursementAccountDefaultProps,
    reimbursementAccountDraft: {},
};

const beneficialOwnerDataKeys = CONST.BANK_ACCOUNT.BENEFICIAL_OWNER_INFO_STEP.BENEFICIAL_OWNER_DATA;
const requestorPersonalInfoKeys = CONST.BANK_ACCOUNT.PERSONAL_INFO_STEP.INPUT_KEY;

function CompanyOwnersListUBO({reimbursementAccount, reimbursementAccountDraft, isAnyoneElseUBO, isUserUBO, handleUBOsConfirmation, beneficialOwners, handleUBOEdit}) {
    const {translate} = useLocalize();

    const requestorData = getSubstepValues(requestorPersonalInfoKeys, {}, reimbursementAccount);

    const error = ErrorUtils.getLatestErrorMessage(reimbursementAccount);

    const renderExtraBeneficialOwners = () =>
        _.map(beneficialOwners, (beneficialOwnerID) => {
            const beneficialOwnerData = getValuesForBeneficialOwner(beneficialOwnerID, reimbursementAccountDraft);

            return (
                <MenuItem
                    title={`${beneficialOwnerData[beneficialOwnerDataKeys.FIRST_NAME]} ${beneficialOwnerData[beneficialOwnerDataKeys.LAST_NAME]}`}
                    description={`${beneficialOwnerData[beneficialOwnerDataKeys.STREET]}, ${beneficialOwnerData[beneficialOwnerDataKeys.CITY]}, ${
                        beneficialOwnerData[beneficialOwnerDataKeys.STATE]
                    } ${beneficialOwnerData[beneficialOwnerDataKeys.ZIP_CODE]}`}
                    wrapperStyle={[styles.ph0]}
                    icon={Expensicons.FallbackAvatar}
                    onPress={() => {
                        handleUBOEdit(beneficialOwnerID);
                    }}
                    iconWidth={40}
                    iconHeight={40}
                    interactive
                    shouldShowRightIcon
                />
            );
        });

    return (
        <ScreenWrapper
            testID={CompanyOwnersListUBO.displayName}
            style={[styles.pt0]}
            scrollEnabled
        >
            <ScrollView contentContainerStyle={[styles.flexGrow1, styles.ph5]}>
                <Text style={[styles.textHeadline]}>{translate('beneficialOwnerInfoStep.letsDoubleCheck')}</Text>
                <Text style={styles.pv5}>{translate('beneficialOwnerInfoStep.regulationRequiresUsToVerifyTheIdentity')}</Text>
                <View>
                    <Text style={[styles.textLabelSupporting, styles.pv1]}>{`${translate('beneficialOwnerInfoStep.owners')}:`}</Text>
                    {isUserUBO && (
                        <MenuItem
                            title={`${requestorData[requestorPersonalInfoKeys.FIRST_NAME]} ${requestorData[requestorPersonalInfoKeys.LAST_NAME]}`}
                            description={`${requestorData[CONST.BANK_ACCOUNT.PERSONAL_INFO_STEP.INPUT_KEY.STREET]}, ${requestorData[CONST.BANK_ACCOUNT.PERSONAL_INFO_STEP.INPUT_KEY.CITY]}, ${
                                requestorData[CONST.BANK_ACCOUNT.PERSONAL_INFO_STEP.INPUT_KEY.STATE]
                            } ${requestorData[CONST.BANK_ACCOUNT.PERSONAL_INFO_STEP.INPUT_KEY.ZIP_CODE]}`}
                            wrapperStyle={[styles.ph0]}
                            icon={Expensicons.FallbackAvatar}
                            iconWidth={40}
                            iconHeight={40}
                            interactive={false}
                            shouldShowRightIcon={false}
                        />
                    )}
                    {isAnyoneElseUBO && renderExtraBeneficialOwners()}
                </View>

                <View style={[styles.ph5, styles.mtAuto]}>
                    {error.length > 0 && (
                        <DotIndicatorMessage
                            textStyles={[styles.formError]}
                            type="error"
                            messages={{0: error}}
                        />
                    )}
                </View>
                <Button
                    success
                    style={[styles.w100, styles.mt2, styles.pb5]}
                    onPress={handleUBOsConfirmation}
                    text={translate('common.confirm')}
                />
            </ScrollView>
        </ScreenWrapper>
    );
}

CompanyOwnersListUBO.propTypes = propTypes;
CompanyOwnersListUBO.defaultProps = defaultProps;
CompanyOwnersListUBO.displayName = 'CompanyOwnersListUBO';

export default withOnyx({
    reimbursementAccount: {
        key: ONYXKEYS.REIMBURSEMENT_ACCOUNT,
    },
    reimbursementAccountDraft: {
        key: ONYXKEYS.REIMBURSEMENT_ACCOUNT_DRAFT,
    },
})(CompanyOwnersListUBO);
