import type {FocusEvent, Key, MutableRefObject, ReactNode, Ref} from 'react';
import type {GestureResponderEvent, NativeSyntheticEvent, StyleProp, TextInputFocusEventData, ViewStyle} from 'react-native';
import type {ValueOf} from 'type-fest';
import type AddressSearch from '@components/AddressSearch';
import type AmountTextInput from '@components/AmountTextInput';
import type CheckboxWithLabel from '@components/CheckboxWithLabel';
import type CountrySelector from '@components/CountrySelector';
import type Picker from '@components/Picker';
import type SingleChoiceQuestion from '@components/SingleChoiceQuestion';
import type StatePicker from '@components/StatePicker';
import type TextInput from '@components/TextInput';
import type {TranslationPaths} from '@src/languages/types';
import type {OnyxFormKey, OnyxValues} from '@src/ONYXKEYS';
import type {BaseForm} from '@src/types/onyx/Form';

/**
 * This type specifies all the inputs that can be used with `InputWrapper` component. Make sure to update it
 * when adding new inputs or removing old ones.
 *
 * TODO: Add remaining inputs here once these components are migrated to Typescript:
 * DatePicker | EmojiPickerButtonDropdown | RoomNameInput | ValuePicker
 */
type ValidInputs =
    | typeof TextInput
    | typeof AmountTextInput
    | typeof SingleChoiceQuestion
    | typeof CheckboxWithLabel
    | typeof Picker
    | typeof AddressSearch
    | typeof CountrySelector
    | typeof StatePicker;

type ValueTypeKey = 'string' | 'boolean' | 'date';
type ValueTypeMap = {
    string: string;
    boolean: boolean;
    date: Date;
};
type FormValue = ValueOf<ValueTypeMap>;

type InputComponentValueProps<TValue extends ValueTypeKey = ValueTypeKey> = {
    valueType?: TValue;
    value?: ValueTypeMap[TValue];
    defaultValue?: ValueTypeMap[TValue];
    onValueChange?: (value: ValueTypeMap[TValue], key: string) => void;
    shouldSaveDraft?: boolean;
    shouldUseDefaultValue?: boolean;
};

type MeasureLayoutOnSuccessCallback = (left: number, top: number, width: number, height: number) => void;
type InputComponentBaseProps = InputComponentValueProps & {
    inputID?: string;
    errorText?: string;
    shouldSetTouchedOnBlurOnly?: boolean;
    isFocused?: boolean;
    measureLayout?: (ref: unknown, callback: MeasureLayoutOnSuccessCallback) => void;
    focus?: () => void;
    onTouched?: (event: GestureResponderEvent) => void;
    onBlur?: (event: FocusEvent | NativeSyntheticEvent<TextInputFocusEventData>) => void;
    onPressOut?: (event: GestureResponderEvent) => void;
    onPress?: (event: GestureResponderEvent) => void;
    onInputChange?: (value: FormValue, key: string) => void;
    key?: Key;
    ref?: Ref<unknown>;
};

type FormOnyxValues<TFormID extends OnyxFormKey = OnyxFormKey> = Omit<OnyxValues[TFormID], keyof BaseForm>;
type FormOnyxKeys<TFormID extends OnyxFormKey = OnyxFormKey> = keyof FormOnyxValues<TFormID>;

type FormProps<TFormID extends OnyxFormKey = OnyxFormKey> = {
    /** A unique Onyx key identifying the form */
    formID: TFormID;

    /** Text to be displayed in the submit button */
    submitButtonText: string;

    /** Controls the submit button's visibility */
    isSubmitButtonVisible?: boolean;

    /** Callback to submit the form */
    onSubmit: (values: FormOnyxValues<TFormID>) => void;

    /** Should the button be enabled when offline */
    enabledWhenOffline?: boolean;

    /** Whether the form submit action is dangerous */
    isSubmitActionDangerous?: boolean;

    /** Should fix the errors alert be displayed when there is an error in the form */
    shouldHideFixErrorsAlert?: boolean;

    /** Whether ScrollWithContext should be used instead of regular ScrollView. Set to true when there's a nested Picker component in Form. */
    scrollContextEnabled?: boolean;

    /** Container styles */
    style?: StyleProp<ViewStyle>;

    /** Custom content to display in the footer after submit button */
    footerContent?: ReactNode;
};

type InputRefs = Record<string, MutableRefObject<InputComponentBaseProps>>;

type FormInputErrors<TFormID extends OnyxFormKey = OnyxFormKey> = Partial<Record<FormOnyxKeys<TFormID>, TranslationPaths>>;

export type {FormProps, ValidInputs, InputComponentValueProps, FormValue, ValueTypeKey, FormOnyxValues, FormOnyxKeys, FormInputErrors, InputRefs, InputComponentBaseProps, ValueTypeMap};
