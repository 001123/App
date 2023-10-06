import React from 'react';
import {View} from 'react-native';
import PropTypes from 'prop-types';
import styles from '../../../../styles/styles';
import ScreenWrapper from '../../../../components/ScreenWrapper';
import FullPageNotFoundView from '../../../../components/BlockingViews/FullPageNotFoundView';
import HeaderWithBackButton from '../../../../components/HeaderWithBackButton';

const propTypes = {
    /** The things to display inside the screenwrapper */
    children: PropTypes.node.isRequired,

    /** The title to show in the header (should be translated already) */
    headerTitle: PropTypes.string.isRequired,

    /** A function triggered when the back button is pressed */
    onBackButtonPress: PropTypes.func.isRequired,

    /** A function triggered when the entry transition is ended. Useful for auto-focusing elements. */
    onEntryTransitionEnd: PropTypes.func,

    /** Whether or not the not-found page should be shown (like when the request isn't a valid IOU) */
    shouldShowNotFound: PropTypes.bool.isRequired,

    /** Whether or not the wrapper should be shown (sometimes screens can be embedded inside another screen that already is using a wrapper) */
    shouldShowWrapper: PropTypes.bool.isRequired,

    /** An ID used for unit testing */
    testID: PropTypes.string.isRequired,
};

const defaultProps = {
    onEntryTransitionEnd: () => {},
};

function StepScreenWrapper({testID, shouldShowNotFound, headerTitle, onBackButtonPress, onEntryTransitionEnd, children, shouldShowWrapper}) {
    if (!shouldShowWrapper) {
        return children;
    }

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableKeyboardAvoidingView={false}
            onEntryTransitionEnd={onEntryTransitionEnd}
            testID={testID}
        >
            {({safeAreaPaddingBottomStyle}) => (
                <FullPageNotFoundView shouldShow={shouldShowNotFound}>
                    <View style={[styles.flex1, safeAreaPaddingBottomStyle]}>
                        <HeaderWithBackButton
                            title={headerTitle}
                            onBackButtonPress={onBackButtonPress}
                        />
                        {children}
                    </View>
                </FullPageNotFoundView>
            )}
        </ScreenWrapper>
    );
}

StepScreenWrapper.displayName = 'StepScreenWrapper';
StepScreenWrapper.propTypes = propTypes;
StepScreenWrapper.defaultProps = defaultProps;

export default StepScreenWrapper;
