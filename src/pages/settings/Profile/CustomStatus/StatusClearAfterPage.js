import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {View} from 'react-native';
import _ from 'lodash';
import {withOnyx} from 'react-native-onyx';
import lodashGet from 'lodash/get';
import PropTypes from 'prop-types';
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
import * as ValidationUtils from '../../../../libs/ValidationUtils';
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
        const {dateValidationErrorKey, timeValidationErrorKey} = ValidationUtils.validateDateTimeIsAtLeastOneMinuteInFuture(data);

        const dateError = dateValidationErrorKey ? localize.translate(dateValidationErrorKey) : '';
        setCustomDateError(dateError);

        const timeError = timeValidationErrorKey ? localize.translate(timeValidationErrorKey) : '';
        setCustomTimeError(timeError);

        return {
            dateError,
            timeError,
        };
    };

    useEffect(() => {
        if (!data) {
            return;
        }
        validate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const validateCustomDate = () => validate();

    return {customDateError, customTimeError, validateCustomDate};
};

function StatusClearAfterPage({currentUserPersonalDetails, customStatus}) {
    const localize = useLocalize();
    const clearAfter = lodashGet(currentUserPersonalDetails, 'status.clearAfter', '');
    const draftClearAfter = lodashGet(customStatus, 'clearAfter', '');
    const [draftPeriod, setDraftPeriod] = useState(getSelectedStatusType(draftClearAfter || clearAfter));
    const statusType = useMemo(
        () =>
            _.map(CONST.CUSTOM_STATUS_TYPES, (value, key) => ({
                value,
                text: localize.translate(`statusPage.timePeriods.${value}`),
                keyForList: key,
                isSelected: draftPeriod === value,
            })),
        [draftPeriod, localize],
    );

    const {customDateError, customTimeError, validateCustomDate} = useValidateCustomDate(draftClearAfter);

    const {redBrickDateIndicator, redBrickTimeIndicator} = useMemo(
        () => ({
            redBrickDateIndicator: customDateError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : null,
            redBrickTimeIndicator: customTimeError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : null,
        }),
        [customTimeError, customDateError],
    );

    const onSubmit = () => {
        const {dateError, timeError} = validateCustomDate();
        if (dateError || timeError) {
            return;
        }
        let calculatedDraftDate = '';
        if (draftPeriod === CONST.CUSTOM_STATUS_TYPES.CUSTOM) {
            calculatedDraftDate = draftClearAfter;
        } else {
            const selectedRange = _.find(statusType, (item) => item.isSelected);
            calculatedDraftDate = DateUtils.getDateFromStatusType(selectedRange.value);
        }
        User.updateDraftCustomStatus({clearAfter: calculatedDraftDate});
        Navigation.goBack(ROUTES.SETTINGS_STATUS);
    };

    const updateMode = useCallback(
        (mode) => {
            if (mode.value === draftPeriod) {
                return;
            }
            setDraftPeriod(mode.value);

            if (mode.value === CONST.CUSTOM_STATUS_TYPES.CUSTOM) {
                User.updateDraftCustomStatus({clearAfter: DateUtils.getOneHourFromNow()});
            } else {
                const selectedRange = _.find(statusType, (item) => item.value === mode.value);
                const calculatedDraftDate = DateUtils.getDateFromStatusType(selectedRange.value);
                User.updateDraftCustomStatus({clearAfter: calculatedDraftDate});
                Navigation.goBack(ROUTES.SETTINGS_STATUS);
            }
        },
        [draftPeriod, statusType],
    );

    useEffect(() => {
        User.updateDraftCustomStatus({
            clearAfter: draftClearAfter || clearAfter,
        });

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const customStatusDate = DateUtils.extractDate(draftClearAfter);
    const customStatusTime = DateUtils.extractTime12Hour(draftClearAfter);

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableMaxHeight
            testID={StatusClearAfterPage.displayName}
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
                isSubmitButtonVisible={false}
                enabledWhenOffline
            >
                <View>
                    <SelectionList
                        sections={[{data: statusType, indexOffset: 0}]}
                        onSelectRow={updateMode}
                        disableInitialFocusOptionStyle
                        wrapperStyle={{flex: null}}
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
