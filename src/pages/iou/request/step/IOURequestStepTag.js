// TODO: This file came from IOURequestStepTag - verify it's still the same when ready to merge and clean up the old file
import React from 'react';
import _ from 'underscore';
import PropTypes from 'prop-types';
import lodashGet from 'lodash/get';
import {withOnyx} from 'react-native-onyx';
import compose from '../../../../libs/compose';
import ROUTES from '../../../../ROUTES';
import * as IOU from '../../../../libs/actions/IOU';
import * as PolicyUtils from '../../../../libs/PolicyUtils';
import Navigation from '../../../../libs/Navigation/Navigation';
import useLocalize from '../../../../hooks/useLocalize';
import ScreenWrapper from '../../../../components/ScreenWrapper';
import HeaderWithBackButton from '../../../../components/HeaderWithBackButton';
import TagPicker from '../../../../components/TagPicker';
import Text from '../../../../components/Text';
import tagPropTypes from '../../../../components/tagPropTypes';
import ONYXKEYS from '../../../../ONYXKEYS';
import reportPropTypes from '../../../reportPropTypes';
import styles from '../../../../styles/styles';
import transactionPropTypes from '../../../../components/transactionPropTypes';

const propTypes = {
    /** Navigation route context info provided by react navigation */
    route: PropTypes.shape({
        /** Route specific parameters used on this screen via route :iouType/new/tag/:reportID? */
        params: PropTypes.shape({
            /** The type of IOU report, i.e. bill, request, send */
            iouType: PropTypes.string,

            /** The ID of the transaction being configured */
            transactionID: PropTypes.string,

            /** The report ID of the IOU */
            reportID: PropTypes.string,
        }),
    }).isRequired,

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

function IOURequestStepTag({route: {iouType, transactionID, reportID}, report, policyTags, transaction}) {
    const {translate} = useLocalize();

    // Fetches the first tag list of the policy
    const tagListKey = _.first(_.keys(policyTags));
    const policyTagListName = PolicyUtils.getTagListName(policyTags) || translate('common.tag');

    const goBack = () => {
        Navigation.goBack(ROUTES.MONEE_REQUEST_STEP.getRoute(iouType, CONST.IOU.REQUEST_STEPS.CONFIRMATION, transactionID, reportID), true);
    };

    const updateTag = (selectedTag) => {
        IOU.setMoneeRequestTag(transactionID, selectedTag.searchText);
        goBack();
    };

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableMaxHeight
            testID={IOURequestStepTag.displayName}
        >
            <HeaderWithBackButton
                title={policyTagListName}
                onBackButtonPress={navigateBack}
            />
            <Text style={[styles.ph5, styles.pv3]}>{translate('iou.tagSelection', {tagName: policyTagListName})}</Text>
            <TagPicker
                policyID={report.policyID}
                tag={tagListKey}
                selectedTag={iou.tag}
                onSubmit={updateTag}
            />
        </ScreenWrapper>
    );
}

IOURequestStepTag.displayName = 'IOURequestStepTag';
IOURequestStepTag.propTypes = propTypes;
IOURequestStepTag.defaultProps = defaultProps;

export default compose(
    withOnyx({
        report: {
            key: ({route}) => `${ONYXKEYS.COLLECTION.REPORT}${lodashGet(route, 'params.reportID')}`,
        },
        transaction: {
            key: ({route}) => `${ONYXKEYS.COLLECTION.TRANSACTION}${lodashGet(route, 'params.transactionID')}`,
        },
    }),
    // eslint-disable-next-line rulesdir/no-multiple-onyx-in-file
    withOnyx({
        policyTags: {
            key: ({report}) => `${ONYXKEYS.COLLECTION.POLICY_TAGS}${report ? report.policyID : '0'}`,
        },
    }),
)(IOURequestStepTag);
