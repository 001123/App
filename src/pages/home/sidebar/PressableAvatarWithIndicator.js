/* eslint-disable rulesdir/onyx-props-must-have-default */
import lodashGet from 'lodash/get';
import PropTypes from 'prop-types';
import React, {useCallback} from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import AvatarWithIndicator from '@components/AvatarWithIndicator';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import PressableWithoutFeedback from '@components/Pressable/PressableWithoutFeedback';
import withCurrentUserPersonalDetails from '@components/withCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import compose from '@libs/compose';
import Navigation from '@libs/Navigation/Navigation';
import * as UserUtils from '@libs/UserUtils';
import personalDetailsPropType from '@pages/personalDetailsPropType';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';

const propTypes = {
    /** Whether the create menu is open or not */
    isCreateMenuOpen: PropTypes.bool,

    /** The personal details of the person who is logged in */
    currentUserPersonalDetails: personalDetailsPropType,

    /** Indicates whether the app is loading initial data */
    isLoading: PropTypes.bool,

    isSelected: PropTypes.bool,
};

const defaultProps = {
    isCreateMenuOpen: false,
    currentUserPersonalDetails: {
        pendingFields: {avatar: ''},
        accountID: '',
        avatar: '',
    },
    isLoading: true,
    isSelected: false,
};

function PressableAvatarWithIndicator({isCreateMenuOpen, currentUserPersonalDetails, isLoading, isSelected}) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const theme = useTheme();

    const showSettingsPage = useCallback(() => {
        if (isCreateMenuOpen) {
            // Prevent opening Settings page when click profile avatar quickly after clicking FAB icon
            return;
        }

        Navigation.navigate(ROUTES.SETTINGS);
    }, [isCreateMenuOpen]);

    const buttonStyle = isSelected ? {borderWidth: 2, borderRadius: 30, borderColor: theme.splashBG} : {};

    return (
        <PressableWithoutFeedback
            accessibilityLabel={translate('sidebarScreen.buttonMySettings')}
            role={CONST.ROLE.BUTTON}
            onPress={showSettingsPage}
        >
            <OfflineWithFeedback pendingAction={lodashGet(currentUserPersonalDetails, 'pendingFields.avatar', null)}>
                <View style={[styles.p1, buttonStyle]}>
                    <AvatarWithIndicator
                        source={UserUtils.getAvatar(currentUserPersonalDetails.avatar, currentUserPersonalDetails.accountID)}
                        tooltipText={translate('profilePage.profile')}
                        fallbackIcon={currentUserPersonalDetails.fallbackIcon}
                        isLoading={isLoading && !currentUserPersonalDetails.avatar}
                    />
                </View>
            </OfflineWithFeedback>
        </PressableWithoutFeedback>
    );
}

PressableAvatarWithIndicator.propTypes = propTypes;
PressableAvatarWithIndicator.defaultProps = defaultProps;
PressableAvatarWithIndicator.displayName = 'PressableAvatarWithIndicator';
export default compose(
    withCurrentUserPersonalDetails,
    withOnyx({
        isLoading: {
            key: ONYXKEYS.IS_LOADING_APP,
        },
    }),
)(PressableAvatarWithIndicator);
