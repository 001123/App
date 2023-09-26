import React from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import lodashGet from 'lodash/get';
import FullscreenLoadingIndicator from '../../../../components/FullscreenLoadingIndicator';
import withLocalize, {withLocalizePropTypes} from '../../../../components/withLocalize';
import HeaderWithBackButton from '../../../../components/HeaderWithBackButton';
import ScreenWrapper from '../../../../components/ScreenWrapper';
import TimePicker from '../../../../components/TimePicker';
import Form from '../../../../components/Form';
import usePrivatePersonalDetails from '../../../../hooks/usePrivatePersonalDetails';
import useWindowDimensions from '../../../../hooks/useWindowDimensions';
import useLocalize from '../../../../hooks/useLocalize';
import Navigation from '../../../../libs/Navigation/Navigation';
import * as User from '../../../../libs/actions/User';
import DateUtils from '../../../../libs/DateUtils';
import * as ValidationUtils from '../../../../libs/ValidationUtils';
import compose from '../../../../libs/compose';
import ONYXKEYS from '../../../../ONYXKEYS';
import ROUTES from '../../../../ROUTES';
import styles from '../../../../styles/styles';

const propTypes = {
    ...withLocalizePropTypes,
};

function SetTimePage({translate, privatePersonalDetails, customStatus}) {
    usePrivatePersonalDetails();
    const {isExtraSmallScreenHeight} = useWindowDimensions();
    const localize = useLocalize();
    const customDateTemporary = lodashGet(customStatus, 'customDateTemporary', '');

    const onSubmit = ({timePicker}) => {
        const timeToUse = DateUtils.combineDateAndTime(timePicker, customDateTemporary);

        User.updateDraftCustomStatus({customDateTemporary: timeToUse});
        Navigation.goBack(ROUTES.SETTINGS_STATUS_CLEAR_AFTER);
    };
    const validate = (v) => {
        const error = {};

        if (!ValidationUtils.isTimeAtLeastOneMinuteInFuture(v.timePicker, customDateTemporary)) {
            error.timePicker = localize.translate('common.error.invalidTimeShouldBeFuture');
        }

        return error;
    };

    if (lodashGet(privatePersonalDetails, 'isLoading', true)) {
        return <FullscreenLoadingIndicator />;
    }
    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            testID={SetTimePage.displayName}
        >
            <HeaderWithBackButton
                title={translate('statusPage.time')}
                onBackButtonPress={() => Navigation.goBack(ROUTES.SETTINGS_STATUS_CLEAR_AFTER)}
            />
            <View style={styles.flex1}>
                <Form
                    style={[styles.flexGrow1]}
                    formID={ONYXKEYS.FORMS.SETTINGS_STATUS_SET_TIME_FORM}
                    onSubmit={onSubmit}
                    submitButtonText={translate('common.save')}
                    submitButtonContainerStyles={[styles.flex0, styles.justifyContentStart, styles.mh5, styles.setTimeFormButtonContainer]}
                    errorMessageStyle={styles.timePickerButtonErrorText}
                    validate={validate}
                    enabledWhenOffline
                    shouldUseDefaultValue
                    useSmallerSubmitButtonSize={isExtraSmallScreenHeight}
                >
                    <TimePicker
                        inputID="timePicker"
                        defaultValue={DateUtils.extractTime12Hour(customDateTemporary)}
                        style={styles.flexGrow1}
                    />
                </Form>
            </View>
        </ScreenWrapper>
    );
}

SetTimePage.propTypes = propTypes;
SetTimePage.displayName = 'SetTimePage';

export default compose(
    withLocalize,
    withOnyx({
        privatePersonalDetails: {
            key: ONYXKEYS.PRIVATE_PERSONAL_DETAILS,
        },
        customStatus: {
            key: ONYXKEYS.CUSTOM_STATUS_DRAFT,
        },
    }),
)(SetTimePage);
