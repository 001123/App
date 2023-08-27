import PropTypes from 'prop-types';
import React from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import ONYXKEYS from '../../ONYXKEYS';
import compose from '../../libs/compose';
import colors from '../../styles/colors';
import styles from '../../styles/styles';
import Icon from '../Icon';
import * as Expensicons from '../Icon/Expensicons';
import Text from '../Text';
import TextLink from '../TextLink';
import withLocalize, {withLocalizePropTypes} from '../withLocalize';

const propTypes = {
    /** The location error code from onyx */
    locationErrorCode: PropTypes.number,

    /** A callback that runs when 'allow location permission' link is pressed */
    onAllowLocationLinkPress: PropTypes.func.isRequired,

    ...withLocalizePropTypes,
};

const defaultProps = {
    locationErrorCode: undefined,
};

function BaseLocationErrorMessage({locationErrorCode, onAllowLocationLinkPress, translate}) {
    if (!locationErrorCode) {
        return null;
    }

    const isPermissionDenied = locationErrorCode === 1;

    return (
        <View style={[styles.dotIndicatorMessage, styles.mt4]}>
            <View style={styles.offlineFeedback.errorDot}>
                <Icon
                    src={Expensicons.DotIndicator}
                    fill={colors.red}
                />
            </View>
            <View style={styles.offlineFeedback.textContainer}>
                {/* 
                  Show appropriate error msg on location issues
                  - errorCode = -1 -> location not supported (web only)
                  - errorCode = 1 -> location permission is not enabled
                  - errorCode = 2 -> location is unavailable or there is some connection issue
                  - errorCode = 3 -> location fetch timeout  
                */}
                {isPermissionDenied ? (
                    <Text style={styles.offlineFeedback.text}>
                        <Text>{`${translate('location.permissionDenied')} ${translate('common.please')}`}</Text>
                        <TextLink onPress={onAllowLocationLinkPress}>{` ${translate('location.allowPermission')} `}</TextLink>
                        <Text>{translate('location.tryAgain')}</Text>
                    </Text>
                ) : (
                    <Text style={styles.offlineFeedback.text}>{translate('location.notFound')}</Text>
                )}
            </View>
        </View>
    );
}

BaseLocationErrorMessage.displayName = 'BaseLocationErrorMessage';
BaseLocationErrorMessage.propTypes = propTypes;
BaseLocationErrorMessage.defaultProps = defaultProps;
export default compose(
    withOnyx({
        locationErrorCode: {
            key: ONYXKEYS.LOCATION_ERROR_CODE,
        },
    }),
    withLocalize,
)(BaseLocationErrorMessage);
