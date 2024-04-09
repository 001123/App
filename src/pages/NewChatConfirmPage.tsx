import React, {useMemo, useRef} from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import AvatarWithImagePicker from '@components/AvatarWithImagePicker';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import ScreenWrapper from '@components/ScreenWrapper';
import SelectionList from '@components/SelectionList';
import InviteMemberListItem from '@components/SelectionList/InviteMemberListItem';
import type {ListItem} from '@components/SelectionList/types';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as OptionsListUtils from '@libs/OptionsListUtils';
import * as ReportUtils from '@libs/ReportUtils';
import * as Report from '@userActions/Report';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type * as OnyxTypes from '@src/types/onyx';
import type {Participant} from '@src/types/onyx/IOU';
import * as Expensicons from '@components/Icon';

type NewChatConfirmPageOnyxProps = {
    /** New group chat draft data */
    newGroupDraft: OnyxEntry<OnyxTypes.NewGroupChatDraft>;

    /** All of the personal details for everyone */
    allPersonalDetails: OnyxEntry<OnyxTypes.PersonalDetailsList>;
};

type NewChatConfirmPageProps = NewChatConfirmPageOnyxProps;

function NewChatConfirmPage({newGroupDraft, allPersonalDetails}: NewChatConfirmPageProps) {
    const fileRef = useRef();
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const personalData = useCurrentUserPersonalDetails();
    const participantAccountIDs = newGroupDraft?.participants.map((participant) => participant.accountID);
    const selectedOptions = useMemo((): Participant[] => {
        if (!newGroupDraft?.participants) {
            return [];
        }
        const options: Participant[] = newGroupDraft.participants.map((participant) =>
            OptionsListUtils.getParticipantsOption({accountID: participant.accountID, login: participant.login, reportID: ''}, allPersonalDetails),
        );
        return options;
    }, [allPersonalDetails, newGroupDraft?.participants]);

    const groupName = newGroupDraft?.reportName ? newGroupDraft?.reportName : ReportUtils.getGroupChatName(participantAccountIDs ?? []);
    const sections: ListItem[] = useMemo(
        () =>
            selectedOptions
                .map((selectedOption: Participant) => {
                    const accountID = selectedOption.accountID;
                    const isAdmin = personalData.accountID === accountID;
                    const section: ListItem = {
                        login: selectedOption?.login ?? '',
                        text: selectedOption?.text ?? '',
                        keyForList: selectedOption?.keyForList ?? '',
                        isSelected: !isAdmin,
                        isDisabled: isAdmin,
                        accountID,
                        icons: selectedOption?.icons,
                        badgeText: isAdmin ? translate('common.admin') : '',
                        alternateText: selectedOption?.login ?? '',
                    };
                    return section;
                })
                .sort((a, b) => a.text?.toLowerCase().localeCompare(b.text?.toLowerCase() ?? '') ?? -1),
        [selectedOptions, personalData.accountID, translate],
    );

    /**
     * Removes a selected option from list if already selected.
     */
    const unselectOption = (option: ListItem) => {
        if (!newGroupDraft) {
            return;
        }
        const newSelectedParticipants = newGroupDraft.participants.filter((participant) => participant.login !== option.login);
        Report.setGroupDraft({participants: newSelectedParticipants});
    };

    const createGroup = () => {
        if (!newGroupDraft) {
            return;
        }

        const logins: string[] = newGroupDraft.participants.map((participant) => participant.login);
        Report.navigateToAndOpenReport(logins, true, newGroupDraft.reportName, newGroupDraft.avatarUri, fileRef.current);
    };

    const navigateBack = () => {
        Navigation.goBack(ROUTES.NEW_CHAT);
    };

    const navigateToEditChatName = () => {
        Navigation.navigate(ROUTES.NEW_CHAT_EDIT_NAME);
    };

    const stashedLocalAvatarImage = newGroupDraft?.avatarUri;
    return (
        <ScreenWrapper testID={NewChatConfirmPage.displayName}>
            <HeaderWithBackButton
                title={translate('common.group')}
                onBackButtonPress={navigateBack}
            />
            <View style={styles.avatarSectionWrapper}>
                <AvatarWithImagePicker
                    isUsingDefaultAvatar={!stashedLocalAvatarImage}
                    source={stashedLocalAvatarImage ?? ReportUtils.getDefaultGroupAvatar()}
                    onImageSelected={(image) => {
                        fileRef.current = image;
                        Report.setGroupDraft({avatarUri: image?.uri ?? ''});
                    }}
                    onImageRemoved={() => Report.setGroupDraft({avatarUri: null})}
                    size={CONST.AVATAR_SIZE.XLARGE}
                    avatarStyle={styles.avatarXLarge}
                    disableViewPhoto
                    editIcon={Expensicons.Camera}
                    editIconStyle={styles.smallEditIconAccount}
                />
            </View>
            <MenuItemWithTopDescription
                title={groupName}
                onPress={navigateToEditChatName}
                shouldShowRightIcon
                shouldCheckActionAllowedOnPress={false}
                description={translate('groupConfirmPage.groupName')}
            />
            <View style={[styles.ph1, styles.flex1]}>
                <SelectionList
                    canSelectMultiple
                    sections={[{title: translate('common.members'), data: sections}]}
                    ListItem={InviteMemberListItem}
                    onSelectRow={unselectOption}
                    showConfirmButton={selectedOptions.length > 1}
                    confirmButtonText={translate('newChatPage.startGroup')}
                    onConfirm={createGroup}
                    shouldHideListOnInitialRender={false}
                />
            </View>
        </ScreenWrapper>
    );
}

NewChatConfirmPage.displayName = 'NewChatConfirmPage';

export default withOnyx<NewChatConfirmPageProps, NewChatConfirmPageOnyxProps>({
    newGroupDraft: {
        key: ONYXKEYS.NEW_GROUP_CHAT_DRAFT,
    },
    allPersonalDetails: {
        key: ONYXKEYS.PERSONAL_DETAILS_LIST,
    },
})(NewChatConfirmPage);
