import React, {useMemo, useCallback, useEffect, useState, useRef} from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import lodashGet from 'lodash/get';
import withCurrentUserPersonalDetails, {withCurrentUserPersonalDetailsPropTypes} from '../../../../components/withCurrentUserPersonalDetails';
import MenuItemWithTopDescription from '../../../../components/MenuItemWithTopDescription';
import * as Expensicons from '../../../../components/Icon/Expensicons';
import withLocalize from '../../../../components/withLocalize';
import Text from '../../../../components/Text';
import MenuItem from '../../../../components/MenuItem';
import Navigation from '../../../../libs/Navigation/Navigation';
import * as User from '../../../../libs/actions/User';
import themeColors from '../../../../styles/themes/default';
import useLocalize from '../../../../hooks/useLocalize';
import styles from '../../../../styles/styles';
import DateUtils from '../../../../libs/DateUtils';
import compose from '../../../../libs/compose';
import ONYXKEYS from '../../../../ONYXKEYS';
import ROUTES from '../../../../ROUTES';
import CONST from '../../../../CONST';
import ScreenWrapper from '../../../../components/ScreenWrapper';
import Form from '../../../../components/Form';
import TextInput from '../../../../components/TextInput';
import EmojiPickerButtonDropdown from '../../../../components/EmojiPicker/EmojiPickerButtonDropdown';
import HeaderWithBackButton from '../../../../components/HeaderWithBackButton';

const INPUT_IDS = {
    EMOJI_CODE: 'emojiCode',
    STATUS_TEXT: 'statusText',
};

const propTypes = {
    ...withCurrentUserPersonalDetailsPropTypes,
};

const initialEmoji = '💬';

function StatusPage({draftStatus, currentUserPersonalDetails}) {
    const localize = useLocalize();
    const [brickRoadIndicator, setBrickRoadIndicator] = useState('');
    const [isFormDirty, setFormDirty] = useState(false);
    const formRef = useRef(null);
    const currentUserEmojiCode = lodashGet(currentUserPersonalDetails, 'status.emojiCode', '');
    const currentUserStatusText = lodashGet(currentUserPersonalDetails, 'status.text', '');
    const currentUserClearAfter = lodashGet(currentUserPersonalDetails, 'status.clearAfter', '');
    const draftEmojiCode = lodashGet(draftStatus, 'emojiCode');
    const draftText = lodashGet(draftStatus, 'text');
    const draftClearAfter = lodashGet(draftStatus, 'clearAfter');

    const defaultEmoji = draftEmojiCode || currentUserEmojiCode || initialEmoji;
    const defaultText = draftText || currentUserStatusText;

    const customClearAfter = useMemo(() => {
        const dataToShow = draftClearAfter || currentUserClearAfter;
        return DateUtils.getLocalizedTimePeriodDescription(dataToShow);
    }, [draftClearAfter, currentUserClearAfter]);

    const isValidClearAfterDate = useCallback(() => {
        const clearAfterTime = draftClearAfter || currentUserClearAfter;
        if (clearAfterTime === CONST.CUSTOM_STATUS_TYPES.NEVER) {
            return true;
        }

        return !DateUtils.hasDateExpired(clearAfterTime);
    }, [draftClearAfter, currentUserClearAfter]);

    const navigateBackToSettingsPage = useCallback(() => Navigation.goBack(ROUTES.SETTINGS_PROFILE, false, true), []);
    const updateStatus = useCallback(
        ({emojiCode, statusText}) => {
            const clearAfterTime = draftClearAfter || currentUserClearAfter;
            if (DateUtils.hasDateExpired(clearAfterTime)) {
                setBrickRoadIndicator(isValidClearAfterDate() ? null : CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR);
                return;
            }

            User.updateCustomStatus({
                text: statusText,
                emojiCode,
                clearAfter: clearAfterTime !== CONST.CUSTOM_STATUS_TYPES.NEVER ? clearAfterTime : '',
            });

            User.clearDraftCustomStatus();
            Navigation.goBack(ROUTES.SETTINGS_PROFILE);
        },
        [currentUserClearAfter, draftClearAfter, isValidClearAfterDate],
    );

    const clearStatus = () => {
        User.clearCustomStatus();
        User.updateDraftCustomStatus({
            text: '',
            emojiCode: '',
            clearAfter: DateUtils.getEndOfToday(),
        });
        formRef.current.resetForm({[INPUT_IDS.EMOJI_CODE]: initialEmoji});
    };

    useEffect(() => setBrickRoadIndicator(isValidClearAfterDate() ? null : CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR), [isValidClearAfterDate]);

    useEffect(() => {
        if (!currentUserEmojiCode && !currentUserClearAfter && !draftClearAfter) {
            User.updateDraftCustomStatus({clearAfter: DateUtils.getEndOfToday()});
        } else {
            User.updateDraftCustomStatus({clearAfter: currentUserClearAfter});
        }

        return () => User.clearDraftCustomStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const checkIfFormIsDirty = useCallback(
        ({emojiCode, statusText}) => {
            const isDirty = currentUserEmojiCode !== emojiCode || currentUserStatusText !== statusText || currentUserClearAfter !== draftClearAfter || initialEmoji === emojiCode;
            setFormDirty(isDirty);
        },
        [currentUserEmojiCode, currentUserStatusText, currentUserClearAfter, draftClearAfter],
    );

    useEffect(() => {
        setFormDirty(!!brickRoadIndicator || currentUserClearAfter !== draftClearAfter);
    }, [currentUserClearAfter, draftClearAfter, brickRoadIndicator]);

    const validateForm = useCallback(
        (v) => {
            checkIfFormIsDirty(v);

            if (brickRoadIndicator) {
                return {clearAfter: ''};
            }
            return {};
        },
        [brickRoadIndicator, checkIfFormIsDirty],
    );
    return (
        <ScreenWrapper
            testID={StatusPage.displayName}
            includeSafeAreaPaddingBottom={false}
            shouldEnableMaxHeight
        >
            <HeaderWithBackButton
                title={localize.translate('statusPage.status')}
                onBackButtonPress={navigateBackToSettingsPage}
            />
            <Form
                formID={ONYXKEYS.FORMS.SETTINGS_STATUS_SET_FORM}
                style={styles.flexGrow1}
                ref={formRef}
                submitButtonText={localize.translate('statusPage.save')}
                submitButtonStyle={styles.mh5}
                onSubmit={updateStatus}
                validate={validateForm}
                enabledWhenOffline
                isDisabled={!isFormDirty}
            >
                <View style={styles.mh5}>
                    <Text style={[styles.textHeadline]}>{localize.translate('statusPage.setStatusTitle')}</Text>
                    <Text style={[styles.textNormal, styles.mt2]}>{localize.translate('statusPage.statusExplanation')}</Text>
                </View>
                <View style={[styles.mb2, styles.mt6]}>
                    <View style={[styles.mb4, styles.ph5]}>
                        <EmojiPickerButtonDropdown
                            inputID={INPUT_IDS.EMOJI_CODE}
                            accessibilityLabel={INPUT_IDS.EMOJI_CODE}
                            accessibilityRole={CONST.ACCESSIBILITY_ROLE.TEXT}
                            defaultValue={defaultEmoji}
                            style={styles.mb3}
                        />
                        <TextInput
                            inputID={INPUT_IDS.STATUS_TEXT}
                            label={localize.translate('statusPage.message')}
                            accessibilityLabel={INPUT_IDS.STATUS_TEXT}
                            accessibilityRole={CONST.ACCESSIBILITY_ROLE.TEXT}
                            defaultValue={defaultText}
                            maxLength={CONST.STATUS_TEXT_MAX_LENGTH}
                            autoFocus
                            shouldDelayFocus
                        />
                    </View>
                    <MenuItemWithTopDescription
                        title={customClearAfter}
                        description={localize.translate('statusPage.clearAfter')}
                        shouldShowRightIcon
                        onPress={() => Navigation.navigate(ROUTES.SETTINGS_STATUS_CLEAR_AFTER)}
                        containerStyle={styles.pr2}
                        brickRoadIndicator={brickRoadIndicator}
                    />

                    {(!!currentUserEmojiCode || !!currentUserStatusText) && (
                        <MenuItem
                            title={localize.translate('statusPage.clearStatus')}
                            titleStyle={styles.ml0}
                            icon={Expensicons.Trashcan}
                            onPress={clearStatus}
                            iconFill={themeColors.danger}
                            wrapperStyle={[styles.pl2]}
                        />
                    )}
                </View>
            </Form>
        </ScreenWrapper>
    );
}

StatusPage.displayName = 'StatusPage';
StatusPage.propTypes = propTypes;

export default compose(
    withLocalize,
    withCurrentUserPersonalDetails,
    withOnyx({
        draftStatus: {
            key: () => ONYXKEYS.CUSTOM_STATUS_DRAFT,
        },
    }),
)(StatusPage);
