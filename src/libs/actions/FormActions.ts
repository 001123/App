import Onyx from 'react-native-onyx';
import {PartialDeep} from 'type-fest';
import {KeyValueMapping} from 'react-native-onyx/lib/types';
import * as OnyxCommon from '../../types/onyx/OnyxCommon';
import {OnyxKey} from '../../ONYXKEYS';

type KeysWhichCouldBeDraft<T extends string> = T extends `${infer Prefix}Draft` ? Prefix : never;

function setIsLoading(formID: OnyxKey, isLoading: boolean) {
    Onyx.merge(formID, {isLoading});
}

function setErrors(formID: OnyxKey, errors: OnyxCommon.Errors) {
    Onyx.merge(formID, {errors});
}

function setErrorFields(formID: OnyxKey, errorFields: OnyxCommon.ErrorFields) {
    Onyx.merge(formID, {errorFields});
}

function setDraftValues<T extends OnyxKey>(formID: KeysWhichCouldBeDraft<T>, draftValues: PartialDeep<KeyValueMapping[`${KeysWhichCouldBeDraft<T>}Draft`], {}>) {
    Onyx.merge(`${formID}Draft`, draftValues);
}
setDraftValues('customStatus', {});
export {setIsLoading, setErrors, setErrorFields, setDraftValues};
