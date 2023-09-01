import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {View} from 'react-native';
import _ from 'lodash';
import {withOnyx} from 'react-native-onyx';
import lodashGet from 'lodash/get';
import PropTypes from 'prop-types';
import moment from 'moment';
import ScreenWrapper from '../../../../components/ScreenWrapper';
import Form from '../../../../components/Form';
import HeaderWithBackButton from '../../../../components/HeaderWithBackButton';
import ROUTES from '../../../../ROUTES';
import Navigation from '../../../../libs/Navigation/Navigation';
import styles from '../../../../styles/styles';
import Text from '../../../../components/Text';
import MenuItemWithTopDescription from '../../../../components/MenuItemWithTopDescription';
import SelectionList from '../../../../components/SelectionList';
import useLocalize from '../../../../hooks/useLocalize';
import ONYXKEYS from '../../../../ONYXKEYS';
import CONST from '../../../../CONST';
import * as User from '../../../../libs/actions/User';
import withLocalize from '../../../../components/withLocalize';
import compose from '../../../../libs/compose';
import DateUtils from '../../../../libs/DateUtils';
import withCurrentUserPersonalDetails, {withCurrentUserPersonalDetailsDefaultProps} from '../../../../components/withCurrentUserPersonalDetails';
import personalDetailsPropType from '../../../personalDetailsPropType';

const defaultProps = {
    ...withCurrentUserPersonalDetailsDefaultProps,
};

const propTypes = {
    currentUserPersonalDetails: personalDetailsPropType,
    customStatus: PropTypes.shape({
        clearAfter: PropTypes.string,
        customDateTemporary: PropTypes.string,
    }),
};

/**
 * @param {string} data -  either a value from CONST.CUSTOM_STATUS_TYPES or a dateTime string in the format YYYY-MM-DD HH:mm
 * @returns {string}
 */
function getSelectedStatusType(data) {
    switch (data) {
        case DateUtils.getEndOfToday():
            return CONST.CUSTOM_STATUS_TYPES.AFTER_TODAY;
        case CONST.CUSTOM_STATUS_TYPES.NEVER:
        case '':
            return CONST.CUSTOM_STATUS_TYPES.NEVER;
        case false:
            return CONST.CUSTOM_STATUS_TYPES.AFTER_TODAY;
        default:
            return CONST.CUSTOM_STATUS_TYPES.CUSTOM;
    }
}

const useValidateCustomDate = (data) => {
    const localize = useLocalize();
    const [customDateError, setCustomDateError] = useState('');
    const [customTimeError, setCustomTimeError] = useState('');

    const validate = () => {
        const inputData = moment(data, 'YYYY-MM-DD HH:mm:ss');
        const currentDate = moment().startOf('day');
        const currentDateTimePlus2 = moment().add(1, 'minutes');

        // Date validation
        if (inputData.isBefore(currentDate)) {
            setCustomDateError(localize.translate('common.error.invalidDateShouldBeFuture'));
        } else {
            setCustomDateError('');
        }

        // Time validation
        if (inputData.isBefore(currentDateTimePlus2)) {
            setCustomTimeError(localize.translate('common.error.invalidTimeShouldBeFuture'));
        } else {
            setCustomTimeError('');
        }
    };

    useEffect(() => {
        validate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const triggerValidation = () => {
        validate();
    };

    return {customDateError, customTimeError, triggerValidation};
};

function StatusClearAfterPage({currentUserPersonalDetails, customStatus}) {
    const localize = useLocalize();
    const clearAfter = lodashGet(currentUserPersonalDetails, 'status.clearAfter', '');
    const draftClearAfter = lodashGet(customStatus, 'clearAfter', '');
    const customDateTemporary = lodashGet(customStatus, 'customDateTemporary', '');
    const [draftPeriod, setDraftPeriod] = useState(getSelectedStatusType(clearAfter || draftClearAfter));
    const localesToThemes = useMemo(
        () =>
            _.map(CONST.CUSTOM_STATUS_TYPES, (value, key) => ({
                value,
                text: localize.translate(`statusPage.timePeriods.${value}`),
                keyForList: key,
                isSelected: draftPeriod === value,
            })),
        [draftPeriod, localize],
    );

    const {customDateError, customTimeError, triggerValidation} = useValidateCustomDate(customDateTemporary);

    const {redBrickDateIndicator, redBrickTimeIndicator} = useMemo(
        () => ({
            redBrickDateIndicator: customDateError ? CONST.BRICK_INDICATOR.ERROR : null,
            redBrickTimeIndicator: customTimeError ? CONST.BRICK_INDICATOR.ERROR : null,
        }),
        [customTimeError, customDateError],
    );

    const onSubmit = () => {
        triggerValidation();
        if (customDateError || customTimeError) return;
        let calculatedDraftDate = '';
        if (draftPeriod === CONST.CUSTOM_STATUS_TYPES.CUSTOM) {
            calculatedDraftDate = customDateTemporary;
        } else {
            const selectedRange = _.find(localesToThemes, (item) => item.isSelected);
            calculatedDraftDate = DateUtils.getDateFromStatusType(selectedRange.value);
        }
        User.updateDraftCustomStatus({clearAfter: calculatedDraftDate, customDateTemporary: calculatedDraftDate});
        Navigation.goBack(ROUTES.SETTINGS_STATUS);
    };

    const updateMode = useCallback(
        (mode) => {
            if (mode.value === draftPeriod) return;
            User.updateDraftCustomStatus({
                customDateTemporary: mode.value === CONST.CUSTOM_STATUS_TYPES.CUSTOM ? DateUtils.getOneHourFromNow() : DateUtils.getDateFromStatusType(mode.value),
            });
            setDraftPeriod(mode.value);
        },
        [draftPeriod],
    );

    useEffect(() => {
        User.updateDraftCustomStatus({
            customDateTemporary: draftClearAfter || clearAfter,
            clearAfter: draftClearAfter || clearAfter,
        });

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const customStatusDate = DateUtils.extractDate(customDateTemporary);
    const customStatusTime = DateUtils.extractTime12Hour(customDateTemporary);

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableMaxHeight
        >
            <HeaderWithBackButton
                title="Status"
                onBackButtonPress={() => Navigation.goBack(ROUTES.SETTINGS_STATUS)}
            />
            <Text style={[styles.textNormal, styles.mh5, styles.mv4]}>When should we clear your status?</Text>
            <Form
                formID={ONYXKEYS.FORMS.SETTINGS_STATUS_SET_CLEAR_AFTER_FORM}
                submitButtonText="Save"
                onSubmit={onSubmit}
                style={styles.flexGrow1}
                scrollContextEnabled={false}
                submitButtonStyle={styles.mh5}
                enabledWhenOffline
            >
                <View>
                    <SelectionList
                        sections={[{data: localesToThemes, indexOffset: 0}]}
                        onSelectRow={updateMode}
                        disableInitialFocusOptionStyle
                        wrapperStyle={{flex: null}}
                        scrollEnabled={false}
                        useSeparator
                    />

                    {draftPeriod === CONST.CUSTOM_STATUS_TYPES.CUSTOM && (
                        <>
                            <MenuItemWithTopDescription
                                title={customStatusDate}
                                description={localize.translate('statusPage.date')}
                                shouldShowRightIcon
                                containerStyle={styles.pr2}
                                onPress={() => Navigation.navigate(ROUTES.SETTINGS_STATUS_CLEAR_AFTER_CUSTOM)}
                                errorText={customDateError}
                                titleTextStyle={styles.flex1}
                                brickRoadIndicator={redBrickDateIndicator}
                            />
                            <MenuItemWithTopDescription
                                title={customStatusTime}
                                description={localize.translate('statusPage.time')}
                                shouldShowRightIcon
                                containerStyle={styles.pr2}
                                onPress={() => Navigation.navigate(ROUTES.SETTINGS_STATUS_CLEAR_AFTER_TIME)}
                                errorText={customTimeError}
                                titleTextStyle={styles.flex1}
                                brickRoadIndicator={redBrickTimeIndicator}
                            />
                        </>
                    )}
                </View>
            </Form>
        </ScreenWrapper>
    );
}

StatusClearAfterPage.displayName = 'StatusClearAfterPage';
StatusClearAfterPage.propTypes = propTypes;
StatusClearAfterPage.defaultProps = defaultProps;

export default compose(
    withCurrentUserPersonalDetails,
    withLocalize,
    withOnyx({
        timePeriodType: {
            key: `${ONYXKEYS.FORMS.SETTINGS_STATUS_SET_CLEAR_AFTER_FORM}Draft`,
        },
        clearDateForm: {
            key: `${ONYXKEYS.FORMS.SETTINGS_STATUS_CLEAR_DATE_FORM}Draft`,
        },
        customStatus: {
            key: ONYXKEYS.CUSTOM_STATUS_DRAFT,
        },
        preferredLocale: {
            key: ONYXKEYS.NVP_PREFERRED_LOCALE,
        },
    }),
)(StatusClearAfterPage);
