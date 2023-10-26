import PropTypes from 'prop-types';
import React, {useEffect} from 'react';
import {ActivityIndicator, View} from 'react-native';
import CONST from '../../CONST';
import HapticFeedback from '../../libs/HapticFeedback';
import KeyboardShortcut from '../../libs/KeyboardShortcut';
import compose from '../../libs/compose';
import * as StyleUtils from '../../styles/StyleUtils';
import styles from '../../styles/styles';
import themeColors from '../../styles/themes/default';
import Icon from '../Icon';
import * as Expensicons from '../Icon/Expensicons';
import PressableWithFeedback from '../Pressable/PressableWithFeedback';
import Text from '../Text';
import refPropTypes from '../refPropTypes';
import withNavigationFallback from '../withNavigationFallback';
import withNavigationFocus from '../withNavigationFocus';
import validateSubmitShortcut from './validateSubmitShortcut';

const propTypes = {
    /** Should the press event bubble across multiple instances when Enter key triggers it. */
    allowBubble: PropTypes.bool,

    /** The text for the button label */
    text: PropTypes.string,

    /** Boolean whether to display the right icon */
    shouldShowRightIcon: PropTypes.bool,

    /** The icon asset to display to the left of the text */
    icon: PropTypes.func,

    /** The icon asset to display to the right of the text */
    iconRight: PropTypes.func,

    /** The fill color to pass into the icon. */
    iconFill: PropTypes.string,

    /** Any additional styles to pass to the left icon container. */
    // eslint-disable-next-line react/forbid-prop-types
    iconStyles: PropTypes.arrayOf(PropTypes.object),

    /** Any additional styles to pass to the right icon container. */
    // eslint-disable-next-line react/forbid-prop-types
    iconRightStyles: PropTypes.arrayOf(PropTypes.object),

    /** Small sized button */
    small: PropTypes.bool,

    /** Large sized button */
    large: PropTypes.bool,

    /** medium sized button */
    medium: PropTypes.bool,

    /** Indicates whether the button should be disabled and in the loading state */
    isLoading: PropTypes.bool,

    /** Indicates whether the button should be disabled */
    isDisabled: PropTypes.bool,

    /** A function that is called when the button is clicked on */
    onPress: PropTypes.func,

    /** A function that is called when the button is long pressed */
    onLongPress: PropTypes.func,

    /** A function that is called when the button is pressed */
    onPressIn: PropTypes.func,

    /** A function that is called when the button is released */
    onPressOut: PropTypes.func,

    /** Callback that is called when mousedown is triggered. */
    onMouseDown: PropTypes.func,

    /** Call the onPress function when Enter key is pressed */
    pressOnEnter: PropTypes.bool,

    /** The priority to assign the enter key event listener. 0 is the highest priority. */
    enterKeyEventListenerPriority: PropTypes.number,

    /** Additional styles to add after local styles. Applied to Pressable portion of button */
    style: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.object), PropTypes.object]),

    /** Additional button styles. Specific to the OpacityView of button */
    // eslint-disable-next-line react/forbid-prop-types
    innerStyles: PropTypes.arrayOf(PropTypes.object),

    /** Additional text styles */
    // eslint-disable-next-line react/forbid-prop-types
    textStyles: PropTypes.arrayOf(PropTypes.object),

    /** Whether we should use the default hover style */
    shouldUseDefaultHover: PropTypes.bool,

    /** Whether we should use the success theme color */
    success: PropTypes.bool,

    /** Whether we should use the danger theme color */
    danger: PropTypes.bool,

    /** Children to replace all inner contents of button */
    children: PropTypes.node,

    /** Should we remove the right border radius top + bottom? */
    shouldRemoveRightBorderRadius: PropTypes.bool,

    /** Should we remove the left border radius top + bottom? */
    shouldRemoveLeftBorderRadius: PropTypes.bool,

    /** Should enable the haptic feedback? */
    shouldEnableHapticFeedback: PropTypes.bool,

    /** Whether Button is on active screen */
    isFocused: PropTypes.bool.isRequired,

    /** Id to use for this button */
    nativeID: PropTypes.string,

    /** Accessibility label for the component */
    accessibilityLabel: PropTypes.string,

    /** A ref to forward the button */
    forwardedRef: refPropTypes,
};

const defaultProps = {
    allowBubble: false,
    text: '',
    shouldShowRightIcon: false,
    icon: null,
    iconRight: Expensicons.ArrowRight,
    iconFill: themeColors.textLight,
    iconStyles: [],
    iconRightStyles: [],
    isLoading: false,
    isDisabled: false,
    small: false,
    large: false,
    medium: false,
    onPress: () => {},
    onLongPress: () => {},
    onPressIn: () => {},
    onPressOut: () => {},
    onMouseDown: undefined,
    pressOnEnter: false,
    enterKeyEventListenerPriority: 0,
    style: [],
    innerStyles: [],
    textStyles: [],
    shouldUseDefaultHover: true,
    success: false,
    danger: false,
    children: null,
    shouldRemoveRightBorderRadius: false,
    shouldRemoveLeftBorderRadius: false,
    shouldEnableHapticFeedback: false,
    nativeID: '',
    accessibilityLabel: '',
    forwardedRef: undefined,
};

function Button({
    allowBubble,
    text,
    shouldShowRightIcon,

    icon,
    iconRight,
    iconFill,
    iconStyles,
    iconRightStyles,

    small,
    large,
    medium,

    isLoading,
    isDisabled,

    onPress,
    onLongPress,
    onPressIn,
    onPressOut,
    onMouseDown,

    pressOnEnter,
    enterKeyEventListenerPriority,

    style,
    innerStyles,
    textStyles,

    shouldUseDefaultHover,
    success,
    danger,
    children,

    shouldRemoveRightBorderRadius,
    shouldRemoveLeftBorderRadius,
    shouldEnableHapticFeedback,

    isFocused,
    nativeID,
    accessibilityLabel,
    forwardedRef,
}) {
    useEffect(() => {
        if (!pressOnEnter) {
            return () => {};
        }

        const shortcutConfig = CONST.KEYBOARD_SHORTCUTS.ENTER;

        // Setup and attach keypress handler for pressing the button with Enter key
        return KeyboardShortcut.subscribe(
            shortcutConfig.shortcutKey,
            (e) => {
                if (!validateSubmitShortcut(isFocused, isDisabled, isLoading, e)) {
                    return;
                }
                onPress();
            },
            shortcutConfig.descriptionKey,
            shortcutConfig.modifiers,
            true,
            allowBubble,
            enterKeyEventListenerPriority,
            false,
        );

        // This effect should run only once during mounting
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const renderContent = () => {
        if (children) {
            return children;
        }

        const textComponent = (
            <Text
                numberOfLines={1}
                selectable={false}
                style={[
                    isLoading && styles.opacity0,
                    styles.pointerEventsNone,
                    styles.buttonText,
                    small && styles.buttonSmallText,
                    medium && styles.buttonMediumText,
                    large && styles.buttonLargeText,
                    success && styles.buttonSuccessText,
                    danger && styles.buttonDangerText,
                    icon && styles.textAlignLeft,
                    ...textStyles,
                ]}
                dataSet={{[CONST.SELECTION_SCRAPER_HIDDEN_ELEMENT]: true}}
            >
                {text}
            </Text>
        );

        if (icon || shouldShowRightIcon) {
            return (
                <View style={[styles.justifyContentBetween, styles.flexRow]}>
                    <View style={[styles.alignItemsCenter, styles.flexRow, styles.flexShrink1]}>
                        {icon && (
                            <View style={[styles.mr1, ...iconStyles]}>
                                <Icon
                                    src={icon}
                                    fill={iconFill}
                                    small={small}
                                />
                            </View>
                        )}
                        {textComponent}
                    </View>
                    {shouldShowRightIcon && (
                        <View style={[styles.justifyContentCenter, styles.ml1, ...iconRightStyles]}>
                            <Icon
                                src={iconRight}
                                fill={iconFill}
                                small={small}
                            />
                        </View>
                    )}
                </View>
            );
        }

        return textComponent;
    };

    return (
        <PressableWithFeedback
            ref={forwardedRef}
            onPress={(e) => {
                if (e && e.type === 'click') {
                    e.currentTarget.blur();
                }

                if (shouldEnableHapticFeedback) {
                    HapticFeedback.press();
                }
                return onPress(e);
            }}
            onLongPress={(e) => {
                if (shouldEnableHapticFeedback) {
                    HapticFeedback.longPress();
                }
                onLongPress(e);
            }}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onMouseDown={onMouseDown}
            disabled={isLoading || isDisabled}
            wrapperStyle={[
                isDisabled ? {...styles.cursorDisabled, ...styles.noSelect} : {},
                styles.buttonContainer,
                shouldRemoveRightBorderRadius ? styles.noRightBorderRadius : undefined,
                shouldRemoveLeftBorderRadius ? styles.noLeftBorderRadius : undefined,
                ...StyleUtils.parseStyleAsArray(style),
            ]}
            style={[
                styles.button,
                small ? styles.buttonSmall : undefined,
                medium ? styles.buttonMedium : undefined,
                large ? styles.buttonLarge : undefined,
                success ? styles.buttonSuccess : undefined,
                danger ? styles.buttonDanger : undefined,
                isDisabled && (success || danger) ? styles.buttonOpacityDisabled : undefined,
                isDisabled && !danger && !success ? styles.buttonDisabled : undefined,
                shouldRemoveRightBorderRadius ? styles.noRightBorderRadius : undefined,
                shouldRemoveLeftBorderRadius ? styles.noLeftBorderRadius : undefined,
                ...innerStyles,
            ]}
            hoverStyle={[
                shouldUseDefaultHover && !isDisabled ? styles.buttonDefaultHovered : undefined,
                success && !isDisabled ? styles.buttonSuccessHovered : undefined,
                danger && !isDisabled ? styles.buttonDangerHovered : undefined,
            ]}
            nativeID={nativeID}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole={CONST.ACCESSIBILITY_ROLE.BUTTON}
            hoverDimmingValue={1}
        >
            {renderContent()}
            {isLoading && (
                <ActivityIndicator
                    color={success || danger ? themeColors.textLight : themeColors.text}
                    style={[styles.pAbsolute, styles.l0, styles.r0]}
                />
            )}
        </PressableWithFeedback>
    );
}

Button.propTypes = propTypes;
Button.defaultProps = defaultProps;
Button.displayName = 'Button';

const ButtonWithRef = React.forwardRef((props, ref) => (
    <Button
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...props}
        forwardedRef={ref}
    />
));

ButtonWithRef.displayName = 'ButtonWithRef';

export default compose(withNavigationFallback, withNavigationFocus)(ButtonWithRef);
