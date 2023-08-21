import React, {useEffect, useCallback, useState, useRef, useMemo, useImperativeHandle} from 'react';
import {View, InteractionManager, NativeModules, findNodeHandle, LayoutAnimation} from 'react-native';
import Onyx, {withOnyx} from 'react-native-onyx';
import PropTypes from 'prop-types';
import _ from 'underscore';
import lodashGet from 'lodash/get';
import styles from '../../../../styles/styles';
import themeColors from '../../../../styles/themes/default';
import Composer from '../../../../components/Composer';
import containerComposeStyles from '../../../../styles/containerComposeStyles';
import useWindowDimensions from '../../../../hooks/useWindowDimensions';
import CONST from '../../../../CONST';
import * as Browser from '../../../../libs/Browser';
import ONYXKEYS from '../../../../ONYXKEYS';
import * as KeyDownListener from '../../../../libs/KeyboardShortcut/KeyDownPressListener';
import * as EmojiPickerActions from '../../../../libs/actions/EmojiPickerAction';
import willBlurTextInputOnTapOutsideFunc from '../../../../libs/willBlurTextInputOnTapOutside';
import ReportActionComposeFocusManager from '../../../../libs/ReportActionComposeFocusManager';
import * as ComposerUtils from '../../../../libs/ComposerUtils';
import * as Report from '../../../../libs/actions/Report';
import usePrevious from '../../../../hooks/usePrevious';
import * as EmojiUtils from '../../../../libs/EmojiUtils';
import * as User from '../../../../libs/actions/User';
import * as ReportUtils from '../../../../libs/ReportUtils';
import withNavigation from '../../../../components/withNavigation';
import withNavigationFocus from '../../../../components/withNavigationFocus';
import compose from '../../../../libs/compose';
import withLocalize, {withLocalizePropTypes} from '../../../../components/withLocalize';
import withKeyboardState, {keyboardStatePropTypes} from '../../../../components/withKeyboardState';
import reportActionPropTypes from '../reportActionPropTypes';
import canFocusInputOnScreenFocus from '../../../../libs/canFocusInputOnScreenFocus';
import debouncedSaveReportComment from './debouncedSaveReportComment';
import UpdateComment from './UpdateComment';
import Suggestions from './Suggestions';

const {RNTextInputReset} = NativeModules;

// For mobile Safari, updating the selection prop on an unfocused input will cause it to automatically gain focus
// and subsequent programmatic focus shifts (e.g., modal focus trap) to show the blue frame (:focus-visible style),
// so we need to ensure that it is only updated after focus.
const isMobileSafari = Browser.isMobileSafari();

/**
 * Broadcast that the user is typing. Debounced to limit how often we publish client events.
 * @param {String} reportID
 */
const debouncedBroadcastUserIsTyping = _.debounce((reportID) => {
    Report.broadcastUserIsTyping(reportID);
}, 100);

const willBlurTextInputOnTapOutside = willBlurTextInputOnTapOutsideFunc();

// We want consistent auto focus behavior on input between native and mWeb so we have some auto focus management code that will
// prevent auto focus on existing chat for mobile device
const shouldFocusInputOnScreenFocus = canFocusInputOnScreenFocus();

const propTypes = {
    /** A method to call when the form is submitted */
    submitForm: PropTypes.func.isRequired,

    /** Array of report actions for this report */
    reportActions: PropTypes.arrayOf(PropTypes.shape(reportActionPropTypes)),

    /** Number of lines for the comment */
    numberOfLines: PropTypes.number,

    /** Details about any modals being used */
    modal: PropTypes.shape({
        /** Indicates if there is a modal currently visible or not */
        isVisible: PropTypes.bool,
    }),

    /** The actions from the parent report */
    parentReportActions: PropTypes.objectOf(PropTypes.shape(reportActionPropTypes)),

    isFullComposerAvailable: PropTypes.bool.isRequired,

    ...withLocalizePropTypes,
    ...keyboardStatePropTypes,
};

const defaultProps = {
    numberOfLines: undefined,
    parentReportActions: {},
    reportActions: [],
    modal: {},
};

function ReportComposerWithSuggestions({
    // Onyx
    modal,
    preferredLocale,
    preferredSkinTone,
    parentReportActions,
    numberOfLines,
    // HOCs
    navigation,
    isKeyboardShown,
    isFocused: isFocusedProp,
    // Props: Report
    reportID,
    report,
    reportActions,
    // Focus
    onFocus,
    onBlur,
    // Unclassified
    isComposerFullSize,
    animatedRef,
    isMenuVisible,
    inputPlaceholder,
    suggestionsRef,
    displayFileInModal,
    textInputShouldClear,
    setTextInputShouldClear,
    isBlockedFromConcierge,
    disabled,
    isFullComposerAvailable,
    setIsFullComposerAvailable,
    setIsCommentEmpty,
    submitForm,
    shouldShowReportRecipientLocalTime,
    shouldShowComposeInput,

    forwardedRef,
}) {
    const [value, setValue] = useState(() => Onyx.tryGetCachedValue(ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT + reportID) || '');
    const commentRef = useRef(value);

    const {isSmallScreenWidth} = useWindowDimensions();
    const maxComposerLines = isSmallScreenWidth ? CONST.COMPOSER.MAX_LINES_SMALL_SCREEN : CONST.COMPOSER.MAX_LINES;

    const isEmptyChat = useMemo(() => _.size(reportActions) === 1, [reportActions]);
    const shouldAutoFocus = !modal.isVisible && (shouldFocusInputOnScreenFocus || isEmptyChat) && shouldShowComposeInput;

    const valueRef = useRef(value);
    valueRef.current = value;

    const [selection, setSelection] = useState(() => ({
        start: isMobileSafari && !shouldAutoFocus ? 0 : value.length,
        end: isMobileSafari && !shouldAutoFocus ? 0 : value.length,
    }));

    const [composerHeight, setComposerHeight] = useState(0);

    const textInputRef = useRef(null);
    const insertedEmojisRef = useRef([]);

    /**
     * Update frequently used emojis list. We debounce this method in the constructor so that UpdateFrequentlyUsedEmojis
     * API is not called too often.
     */
    const debouncedUpdateFrequentlyUsedEmojis = useCallback(() => {
        User.updateFrequentlyUsedEmojis(EmojiUtils.getFrequentlyUsedEmojis(insertedEmojisRef.current));
        insertedEmojisRef.current = [];
    }, []);

    const onInsertedEmoji = useCallback(
        (emojiObject) => {
            insertedEmojisRef.current = [...insertedEmojisRef.current, emojiObject];
            debouncedUpdateFrequentlyUsedEmojis(emojiObject);
        },
        [debouncedUpdateFrequentlyUsedEmojis],
    );

    /**
     * Set the TextInput Ref
     *
     * @param {Element} el
     * @memberof ReportActionCompose
     */
    const setTextInputRef = useCallback(
        (el) => {
            ReportActionComposeFocusManager.composerRef.current = el;
            textInputRef.current = el;
            if (_.isFunction(animatedRef)) {
                animatedRef(el);
            }
        },
        [animatedRef],
    );

    const resetKeyboardInput = useCallback(() => {
        if (!RNTextInputReset) {
            return;
        }
        RNTextInputReset.resetKeyboardInput(findNodeHandle(textInputRef));
    }, [textInputRef]);

    /**
     * Update the value of the comment in Onyx
     *
     * @param {String} comment
     * @param {Boolean} shouldDebounceSaveComment
     */
    const updateComment = useCallback(
        (commentValue, shouldDebounceSaveComment) => {
            const {text: newComment = '', emojis = []} = EmojiUtils.replaceEmojis(commentValue, preferredSkinTone, preferredLocale);

            if (!_.isEmpty(emojis)) {
                insertedEmojisRef.current = [...insertedEmojisRef.current, ...emojis];
                debouncedUpdateFrequentlyUsedEmojis();
            }

            setIsCommentEmpty(!!newComment.match(/^(\s)*$/));
            setValue(newComment);
            if (commentValue !== newComment) {
                const remainder = ComposerUtils.getCommonSuffixLength(commentRef.current, newComment);
                setSelection({
                    start: newComment.length - remainder,
                    end: newComment.length - remainder,
                });
            }

            // Indicate that draft has been created.
            if (commentRef.current.length === 0 && newComment.length !== 0) {
                Report.setReportWithDraft(reportID, true);
            }

            // The draft has been deleted.
            if (newComment.length === 0) {
                Report.setReportWithDraft(reportID, false);
            }

            commentRef.current = newComment;
            if (shouldDebounceSaveComment) {
                debouncedSaveReportComment(reportID, newComment);
            } else {
                Report.saveReportComment(reportID, newComment || '');
            }
            if (newComment) {
                debouncedBroadcastUserIsTyping(reportID);
            }
        },
        [debouncedUpdateFrequentlyUsedEmojis, preferredLocale, preferredSkinTone, reportID, setIsCommentEmpty],
    );

    /**
     * Update the number of lines for a comment in Onyx
     * @param {Number} numberOfLines
     */
    const updateNumberOfLines = useCallback(
        (newNumberOfLines) => {
            Report.saveReportCommentNumberOfLines(reportID, newNumberOfLines);
        },
        [reportID],
    );

    /**
     * @returns {String}
     */
    const prepareCommentAndResetComposer = useCallback(() => {
        const trimmedComment = commentRef.current.trim();
        const commentLength = ReportUtils.getCommentLength(trimmedComment);

        // Don't submit empty comments or comments that exceed the character limit
        if (!commentLength || commentLength > CONST.MAX_COMMENT_LENGTH) {
            return '';
        }

        updateComment('');
        setTextInputShouldClear(true);
        if (isComposerFullSize) {
            Report.setIsComposerFullSize(reportID, false);
        }
        setIsFullComposerAvailable(false);
        return trimmedComment;
    }, [updateComment, setTextInputShouldClear, isComposerFullSize, setIsFullComposerAvailable, reportID]);

    /**
     * Callback to add whatever text is chosen into the main input (used f.e as callback for the emoji picker)
     * @param {String} text
     * @param {Boolean} shouldAddTrailSpace
     */
    const replaceSelectionWithText = useCallback(
        (text, shouldAddTrailSpace = true) => {
            const updatedText = shouldAddTrailSpace ? `${text} ` : text;
            const selectionSpaceLength = shouldAddTrailSpace ? CONST.SPACE_LENGTH : 0;
            updateComment(ComposerUtils.insertText(commentRef.current, selection, updatedText));
            setSelection((prevSelection) => ({
                start: prevSelection.start + text.length + selectionSpaceLength,
                end: prevSelection.start + text.length + selectionSpaceLength,
            }));
        },
        [selection, updateComment],
    );

    const triggerHotkeyActions = useCallback(
        (e) => {
            if (!e || ComposerUtils.canSkipTriggerHotkeys(isSmallScreenWidth, isKeyboardShown)) {
                return;
            }

            if (suggestionsRef.current.triggerHotkeyActions(e)) {
                return;
            }

            // Submit the form when Enter is pressed
            if (e.key === CONST.KEYBOARD_SHORTCUTS.ENTER.shortcutKey && !e.shiftKey) {
                e.preventDefault();
                submitForm();
            }

            // Trigger the edit box for last sent message if ArrowUp is pressed and the comment is empty and Chronos is not in the participants
            const valueLength = valueRef.current.length;
            if (e.key === CONST.KEYBOARD_SHORTCUTS.ARROW_UP.shortcutKey && textInputRef.current.selectionStart === 0 && valueLength === 0 && !ReportUtils.chatIncludesChronos(report)) {
                e.preventDefault();

                const parentReportActionID = lodashGet(report, 'parentReportActionID', '');
                const parentReportAction = lodashGet(parentReportActions, [parentReportActionID], {});
                const lastReportAction = _.find([...reportActions, parentReportAction], (action) => ReportUtils.canEditReportAction(action));

                if (lastReportAction !== -1 && lastReportAction) {
                    Report.saveReportActionDraft(reportID, lastReportAction.reportActionID, _.last(lastReportAction.message).html);
                }
            }
        },
        [isKeyboardShown, isSmallScreenWidth, parentReportActions, report, reportActions, reportID, submitForm, suggestionsRef, valueRef],
    );

    const onSelectionChange = useCallback(
        (e) => {
            LayoutAnimation.configureNext(LayoutAnimation.create(50, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));

            if (suggestionsRef.current.onSelectionChange(e)) {
                return;
            }

            setSelection(e.nativeEvent.selection);
        },
        [suggestionsRef],
    );

    const updateShouldShowSuggestionMenuToFalse = useCallback(() => {
        if (!suggestionsRef.current) {
            return;
        }
        suggestionsRef.current.updateShouldShowSuggestionMenuToFalse(false);
    }, [suggestionsRef]);

    /**
     * Focus the composer text input
     * @param {Boolean} [shouldDelay=false] Impose delay before focusing the composer
     * @memberof ReportActionCompose
     */
    const focus = useCallback((shouldDelay = false) => {
        // There could be other animations running while we trigger manual focus.
        // This prevents focus from making those animations janky.
        InteractionManager.runAfterInteractions(() => {
            if (!textInputRef.current) {
                return;
            }

            if (!shouldDelay) {
                textInputRef.current.focus();
            } else {
                // Keyboard is not opened after Emoji Picker is closed
                // SetTimeout is used as a workaround
                // https://github.com/react-native-modal/react-native-modal/issues/114
                // We carefully choose a delay. 100ms is found enough for keyboard to open.
                setTimeout(() => textInputRef.current.focus(), 100);
            }
        });
    }, []);

    const setUpComposeFocusManager = useCallback(() => {
        // This callback is used in the contextMenuActions to manage giving focus back to the compose input.
        // TODO: we should clean up this convoluted code and instead move focus management to something like ReportFooter.js or another higher up component
        ReportActionComposeFocusManager.onComposerFocus(() => {
            if (!willBlurTextInputOnTapOutside || !isFocusedProp) {
                return;
            }

            focus(false);
        });
    }, [focus, isFocusedProp]);

    /**
     * Check if the composer is visible. Returns true if the composer is not covered up by emoji picker or menu. False otherwise.
     * @returns {Boolean}
     */
    const checkComposerVisibility = useCallback(() => {
        const isComposerCoveredUp = EmojiPickerActions.isEmojiPickerVisible() || isMenuVisible || modal.isVisible;
        return !isComposerCoveredUp;
    }, [isMenuVisible, modal.isVisible]);

    const focusComposerOnKeyPress = useCallback(
        (e) => {
            const isComposerVisible = checkComposerVisibility();
            if (!isComposerVisible) {
                return;
            }

            // If the key pressed is non-character keys like Enter, Shift, ... do not focus
            if (e.key.length > 1) {
                return;
            }

            // If a key is pressed in combination with Meta, Control or Alt do not focus
            if (e.metaKey || e.ctrlKey || e.altKey) {
                return;
            }

            // If the space key is pressed, do not focus
            if (e.code === 'Space') {
                return;
            }

            // if we're typing on another input/text area, do not focus
            if (['INPUT', 'TEXTAREA'].includes(e.target.nodeName)) {
                return;
            }

            focus();
            replaceSelectionWithText(e.key, false);
        },
        [checkComposerVisibility, focus, replaceSelectionWithText],
    );

    useEffect(() => {
        const unsubscribeNavigationBlur = navigation.addListener('blur', () => KeyDownListener.removeKeyDownPressListner(focusComposerOnKeyPress));
        const unsubscribeNavigationFocus = navigation.addListener('focus', () => {
            KeyDownListener.addKeyDownPressListner(focusComposerOnKeyPress);
            setUpComposeFocusManager();
        });
        KeyDownListener.addKeyDownPressListner(focusComposerOnKeyPress);

        setUpComposeFocusManager();

        return () => {
            ReportActionComposeFocusManager.clear();

            KeyDownListener.removeKeyDownPressListner(focusComposerOnKeyPress);
            unsubscribeNavigationBlur();
            unsubscribeNavigationFocus();
        };
    }, [focusComposerOnKeyPress, navigation, setUpComposeFocusManager]);

    const prevIsModalVisible = usePrevious(modal.isVisible);
    const prevIsFocused = usePrevious(isFocusedProp);
    useEffect(() => {
        // We want to focus or refocus the input when a modal has been closed or the underlying screen is refocused.
        // We avoid doing this on native platforms since the software keyboard popping
        // open creates a jarring and broken UX.
        if (!(willBlurTextInputOnTapOutside && !modal.isVisible && isFocusedProp && (prevIsModalVisible || !prevIsFocused))) {
            return;
        }

        focus();
    }, [focus, prevIsFocused, prevIsModalVisible, isFocusedProp, modal.isVisible]);

    useEffect(() => {
        // TODO:  I don't know why this line is needed, it just feels wrong
        updateComment(commentRef.current);

        if (value.length !== 0) {
            Report.setReportWithDraft(reportID, true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(
        forwardedRef,
        () => ({
            focus,
            replaceSelectionWithText,
            prepareCommentAndResetComposer,
        }),
        [focus, prepareCommentAndResetComposer, replaceSelectionWithText],
    );

    return (
        <>
            <View style={[containerComposeStyles, styles.textInputComposeBorder]}>
                <Composer
                    checkComposerVisibility={checkComposerVisibility}
                    autoFocus={shouldAutoFocus}
                    multiline
                    ref={setTextInputRef}
                    textAlignVertical="top"
                    placeholder={inputPlaceholder}
                    placeholderTextColor={themeColors.placeholderText}
                    onChangeText={(commentValue) => updateComment(commentValue, true)}
                    onKeyPress={triggerHotkeyActions}
                    style={[styles.textInputCompose, isComposerFullSize ? styles.textInputFullCompose : styles.flex4]}
                    maxLines={maxComposerLines}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    onClick={updateShouldShowSuggestionMenuToFalse}
                    onPasteFile={displayFileInModal}
                    shouldClear={textInputShouldClear}
                    onClear={() => setTextInputShouldClear(false)}
                    isDisabled={isBlockedFromConcierge || disabled}
                    selection={selection}
                    onSelectionChange={onSelectionChange}
                    isFullComposerAvailable={isFullComposerAvailable}
                    setIsFullComposerAvailable={setIsFullComposerAvailable}
                    isComposerFullSize={isComposerFullSize}
                    value={value}
                    numberOfLines={numberOfLines}
                    onNumberOfLinesChange={updateNumberOfLines}
                    shouldCalculateCaretPosition
                    onLayout={(e) => {
                        const composerLayoutHeight = e.nativeEvent.layout.height;
                        if (composerHeight === composerLayoutHeight) {
                            return;
                        }
                        setComposerHeight(composerLayoutHeight);
                    }}
                    onScroll={updateShouldShowSuggestionMenuToFalse}
                />
            </View>

            <Suggestions
                ref={suggestionsRef}
                isComposerFullSize={isComposerFullSize}
                updateComment={updateComment}
                composerHeight={composerHeight}
                shouldShowReportRecipientLocalTime={shouldShowReportRecipientLocalTime}
                onInsertedEmoji={onInsertedEmoji}
                // Input
                value={value}
                setValue={setValue}
                selection={selection}
                setSelection={setSelection}
                resetKeyboardInput={resetKeyboardInput}
            />

            <UpdateComment
                reportID={reportID}
                report={report}
                value={value}
                updateComment={updateComment}
                commentRef={commentRef}
            />
        </>
    );
}

ReportComposerWithSuggestions.propTypes = propTypes;
ReportComposerWithSuggestions.defaultProps = defaultProps;

export default compose(
    withLocalize,
    withNavigation,
    withNavigationFocus,
    withKeyboardState,
    withOnyx({
        numberOfLines: {
            key: ({reportID}) => `${ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT_NUMBER_OF_LINES}${reportID}`,
        },
        modal: {
            key: ONYXKEYS.MODAL,
        },
        preferredSkinTone: {
            key: ONYXKEYS.PREFERRED_EMOJI_SKIN_TONE,
            selector: EmojiUtils.getPreferredSkinToneIndex,
        },
        parentReportActions: {
            key: ({report}) => `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.parentReportID}`,
            canEvict: false,
        },
    }),
)(
    React.forwardRef((props, ref) => (
        <ReportComposerWithSuggestions
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...props}
            forwardedRef={ref}
        />
    )),
);
