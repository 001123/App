import React from 'react';
import {withOnyx} from 'react-native-onyx';
import TagPicker from '@components/TagPicker';
import tagPropTypes from '@components/tagPropTypes';
import Text from '@components/Text';
import transactionPropTypes from '@components/transactionPropTypes';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import compose from '@libs/compose';
import Navigation from '@libs/Navigation/Navigation';
import * as PolicyUtils from '@libs/PolicyUtils';
import * as TransactionUtils from '@libs/TransactionUtils';
import reportPropTypes from '@pages/reportPropTypes';
import * as IOU from '@userActions/IOU';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import IOURequestStepRoutePropTypes from './IOURequestStepRoutePropTypes';
import StepScreenWrapper from './StepScreenWrapper';
import withFullTransactionOrNotFound from './withFullTransactionOrNotFound';
import withWritableReportOrNotFound from './withWritableReportOrNotFound';

const propTypes = {
    /** Navigation route context info provided by react navigation */
    route: IOURequestStepRoutePropTypes.isRequired,

    /* Onyx props */
    /** Holds data related to Money Request view state, rather than the underlying Money Request data. */
    transaction: transactionPropTypes,

    /** The report currently being used */
    report: reportPropTypes,

    /** Collection of tags attached to a policy */
    policyTags: tagPropTypes,
};

const defaultProps = {
    report: {},
    policyTags: {},
    transaction: {},
};

function IOURequestStepTag({
    policyTags,
    report,
    route: {
        params: {tagIndex: rawTagIndex, transactionID, backTo},
    },
    transaction,
}) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    const tagIndex = Number(rawTagIndex);
    const policyTagListName = PolicyUtils.getTagListName(policyTags, tagIndex);
    const transactionTag = TransactionUtils.getTag(transaction);
    const tag = TransactionUtils.getTag(transaction, tagIndex);

    const navigateBack = () => {
        Navigation.goBack(backTo || ROUTES.HOME);
    };

    /**
     * @param {Object} selectedTag
     * @param {String} selectedTag.searchText
     */
    const updateTag = (selectedTag) => {
        if (tag === selectedTag.searchText) {
            IOU.resetMoneyRequestTag_temporaryForRefactor(transactionID, transactionTag, tagIndex);
        } else {
            IOU.setMoneyRequestTag_temporaryForRefactor(transactionID, transactionTag, selectedTag.searchText, tagIndex);
        }
        navigateBack();
    };

    return (
        <StepScreenWrapper
            headerTitle={policyTagListName}
            onBackButtonPress={navigateBack}
            shouldShowWrapper
            testID={IOURequestStepTag.displayName}
        >
            {({insets}) => (
                <>
                    <Text style={[styles.ph5, styles.pv3]}>{translate('iou.tagSelection', {tagName: policyTagListName})}</Text>

                    <TagPicker
                        policyID={report.policyID}
                        tag={policyTagListName}
                        tagIndex={tagIndex}
                        selectedTag={tag}
                        insets={insets}
                        onSubmit={updateTag}
                    />
                </>
            )}
        </StepScreenWrapper>
    );
}

IOURequestStepTag.displayName = 'IOURequestStepTag';
IOURequestStepTag.propTypes = propTypes;
IOURequestStepTag.defaultProps = defaultProps;

export default compose(
    withWritableReportOrNotFound,
    withFullTransactionOrNotFound,
    withOnyx({
        policyTags: {
            key: ({report}) => `${ONYXKEYS.COLLECTION.POLICY_TAGS}${report ? report.policyID : '0'}`,
        },
    }),
)(IOURequestStepTag);
