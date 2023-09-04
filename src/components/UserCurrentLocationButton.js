import PropTypes from 'prop-types';
import React, {useEffect, useRef} from 'react';
import {Text} from 'react-native';
import getCurrentPosition from '../libs/getCurrentPosition';
import * as User from '../libs/actions/User';
import styles from '../styles/styles';
import Icon from './Icon';
import * as Expensicons from './Icon/Expensicons';
import LocationErrorMessage from './LocationErrorMessage';
import withLocalize, {withLocalizePropTypes} from './withLocalize';
import colors from '../styles/colors';
import PressableWithFeedback from './Pressable/PressableWithFeedback';

const propTypes = {
    /** Callback that runs when location data is fetched */
    onLocationFetched: PropTypes.func.isRequired,

    /** Callback that runs when fetching location has errors */
    onLocationError: PropTypes.func,

    /** Callback that runs when location button is clicked */
    onClick: PropTypes.func,

    /** Boolean to indicate if the button is clickable */
    isDisabled: PropTypes.bool,

    ...withLocalizePropTypes,
};

const defaultProps = {
    isDisabled: false,
    onLocationError: () => {},
    onClick: () => {},
};

function UserCurrentLocationButton({onLocationFetched, onLocationError, onClick, isDisabled, translate}) {
    const isFetchingLocation = useRef(false);
    const shouldTriggerCallbacks = useRef(true);

    /** Gets the user's current location and registers success/error callbacks */
    const getUserLocation = () => {
        if (isFetchingLocation.current) return;

        isFetchingLocation.current = true;

        onClick();

        getCurrentPosition(
            (successData) => {
                isFetchingLocation.current = false;
                if (!shouldTriggerCallbacks.current) {
                    return;
                }

                User.clearLocationError();
                onLocationFetched(successData);
            },
            (errorData) => {
                isFetchingLocation.current = false;
                if (!shouldTriggerCallbacks.current) {
                    return;
                }

                User.setLocationError(errorData.code);
                onLocationError(errorData);
            },
            {
                maximumAge: 0, // No cache, always get fresh location info
                timeout: 5000,
            },
        );
    };

    useEffect(() => {
        // Clear location errors on mount
        User.clearLocationError();

        return () => {
            // If the component unmounts we don't want any of the callback for geolocation to run.
            shouldTriggerCallbacks.current = false;
        };
    }, []);

    return (
        <>
            <PressableWithFeedback
                style={[styles.flexRow, styles.mt4, styles.alignSelfStart, isDisabled && styles.buttonOpacityDisabled]}
                onPress={getUserLocation}
                accessibilityLabel={translate('location.useCurrent')}
                disabled={isDisabled}
            >
                <Icon
                    src={Expensicons.Location}
                    fill={colors.green}
                />
                <Text style={[styles.textLabel, styles.mh2, isDisabled && styles.userSelectNone]}>{translate('location.useCurrent')}</Text>
            </PressableWithFeedback>
            <LocationErrorMessage />
        </>
    );
}

UserCurrentLocationButton.displayName = 'UserCurrentLocationButton';
UserCurrentLocationButton.propTypes = propTypes;
UserCurrentLocationButton.defaultProps = defaultProps;
export default withLocalize(UserCurrentLocationButton);
