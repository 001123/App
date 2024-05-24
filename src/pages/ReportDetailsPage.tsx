import {useRoute} from '@react-navigation/native';
import type {StackScreenProps} from '@react-navigation/stack';
import React, {useEffect, useMemo, useState} from 'react';
import {View} from 'react-native';
import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import {withOnyx} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import AvatarWithImagePicker from '@components/AvatarWithImagePicker';
import FullPageNotFoundView from '@components/BlockingViews/FullPageNotFoundView';
import ConfirmModal from '@components/ConfirmModal';
import DisplayNames from '@components/DisplayNames';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as Expensicons from '@components/Icon/Expensicons';
import MenuItem from '@components/MenuItem';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import MultipleAvatars from '@components/MultipleAvatars';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import ParentNavigationSubtitle from '@components/ParentNavigationSubtitle';
import PressableWithoutFeedback from '@components/Pressable/PressableWithoutFeedback';
import PromotedActionsBar, {usePromotedActions} from '@components/PromotedActionsBar';
import RoomHeaderAvatars from '@components/RoomHeaderAvatars';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import type {ReportDetailsNavigatorParamList} from '@libs/Navigation/types';
import * as OptionsListUtils from '@libs/OptionsListUtils';
import * as PolicyUtils from '@libs/PolicyUtils';
import * as ReportUtils from '@libs/ReportUtils';
import * as Report from '@userActions/Report';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import type IconAsset from '@src/types/utils/IconAsset';
import type {WithReportOrNotFoundProps} from './home/report/withReportOrNotFound';
import withReportOrNotFound from './home/report/withReportOrNotFound';

type ReportDetailsPageMenuItem = {
    key: DeepValueOf<typeof CONST.REPORT_DETAILS_MENU_ITEM>;
    translationKey: TranslationPaths;
    icon: IconAsset;
    isAnonymousAction: boolean;
    action: () => void;
    brickRoadIndicator?: ValueOf<typeof CONST.BRICK_ROAD_INDICATOR_STATUS>;
    subtitle?: number;
};

type ReportDetailsPageOnyxProps = {
    /** Personal details of all the users */
    personalDetails: OnyxCollection<OnyxTypes.PersonalDetails>;

    /** Session info for the currently logged in user. */
    session: OnyxEntry<OnyxTypes.Session>;
};
type ReportDetailsPageProps = ReportDetailsPageOnyxProps & WithReportOrNotFoundProps & StackScreenProps<ReportDetailsNavigatorParamList, typeof SCREENS.REPORT_DETAILS.ROOT>;

function ReportDetailsPage({policies, report, session, personalDetails}: ReportDetailsPageProps) {
    const {translate} = useLocalize();
    const {isOffline} = useNetwork();
    const styles = useThemeStyles();
    const route = useRoute();
    const policy = useMemo(() => policies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID ?? ''}`], [policies, report?.policyID]);
    const isPolicyAdmin = useMemo(() => PolicyUtils.isPolicyAdmin(policy ?? null), [policy]);
    const isPolicyEmployee = useMemo(() => PolicyUtils.isPolicyEmployee(report?.policyID ?? '', policies), [report?.policyID, policies]);
    const shouldUseFullTitle = useMemo(() => ReportUtils.shouldUseFullTitleToDisplay(report), [report]);
    const isChatRoom = useMemo(() => ReportUtils.isChatRoom(report), [report]);
    const isUserCreatedPolicyRoom = useMemo(() => ReportUtils.isUserCreatedPolicyRoom(report), [report]);
    const isDefaultRoom = useMemo(() => ReportUtils.isDefaultRoom(report), [report]);
    const isChatThread = useMemo(() => ReportUtils.isChatThread(report), [report]);
    const isArchivedRoom = useMemo(() => ReportUtils.isArchivedRoom(report), [report]);
    const isMoneyRequestReport = useMemo(() => ReportUtils.isMoneyRequestReport(report), [report]);
    const isMoneyRequest = useMemo(() => ReportUtils.isMoneyRequest(report), [report]);
    const isInvoiceReport = useMemo(() => ReportUtils.isInvoiceReport(report), [report]);
    const canEditReportDescription = useMemo(() => ReportUtils.canEditReportDescription(report, policy), [report, policy]);
    const shouldShowReportDescription = isChatRoom && (canEditReportDescription || report.description !== '');
    const [isLastMemberLeavingGroupModalVisible, setIsLastMemberLeavingGroupModalVisible] = useState(false);
    const isExpenseReport = isMoneyRequestReport || isInvoiceReport || isMoneyRequest;
    const isPolicy = isPolicyAdmin || isPolicyEmployee;

    // eslint-disable-next-line react-hooks/exhaustive-deps -- policy is a dependency because `getChatRoomSubtitle` calls `getPolicyName` which in turn retrieves the value from the `policy` value stored in Onyx
    const chatRoomSubtitle = useMemo(() => ReportUtils.getChatRoomSubtitle(report), [report, policy]);
    const parentNavigationSubtitleData = ReportUtils.getParentNavigationSubtitle(report);
    const isGroupChat = useMemo(() => ReportUtils.isGroupChat(report), [report]);
    const isThread = useMemo(() => ReportUtils.isThread(report), [report]);
    const participants = useMemo(() => {
        if (isGroupChat) {
            return ReportUtils.getParticipantAccountIDs(report.reportID ?? '');
        }

        return ReportUtils.getVisibleChatMemberAccountIDs(report.reportID ?? '');
    }, [report, isGroupChat]);

    // Get the active chat members by filtering out the pending members with delete action
    const activeChatMembers = participants.flatMap((accountID) => {
        const pendingMember = report?.pendingChatMembers?.findLast((member) => member.accountID === accountID.toString());
        return !pendingMember || pendingMember.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE ? accountID : [];
    });

    const isPrivateNotesFetchTriggered = report?.isLoadingPrivateNotes !== undefined;

    const isSelfDM = useMemo(() => ReportUtils.isSelfDM(report), [report]);

    const PromotedActions = usePromotedActions({report});

    useEffect(() => {
        // Do not fetch private notes if isLoadingPrivateNotes is already defined, or if the network is offline, or if the report is a self DM.
        if (isPrivateNotesFetchTriggered || isOffline || isSelfDM) {
            return;
        }

        Report.getReportPrivateNote(report?.reportID ?? '');
    }, [report?.reportID, isOffline, isPrivateNotesFetchTriggered, isSelfDM]);

    const menuItems: ReportDetailsPageMenuItem[] = useMemo(() => {
        const items: ReportDetailsPageMenuItem[] = [];

        if (isSelfDM) {
            return [];
        }

        if (isArchivedRoom) {
            return items;
        }

        // The Members page is only shown when:
        // - The report is a thread in a chat report
        // - The report is not a user created room with participants to show i.e. DM, Group Chat, etc
        // - The report is a user created room and the room and the current user is a workspace member i.e. non-workspace members should not see this option.
        if (
            (isGroupChat ||
                (isDefaultRoom && isChatThread && isPolicyEmployee) ||
                (!isUserCreatedPolicyRoom && participants.length) ||
                (isUserCreatedPolicyRoom && (isPolicyEmployee || (isChatThread && !ReportUtils.isPublicRoom(report))))) &&
            !ReportUtils.isConciergeChatReport(report)
        ) {
            items.push({
                key: CONST.REPORT_DETAILS_MENU_ITEM.MEMBERS,
                translationKey: 'common.members',
                icon: Expensicons.Users,
                subtitle: activeChatMembers.length,
                isAnonymousAction: false,
                action: () => {
                    if (isUserCreatedPolicyRoom || isChatThread) {
                        Navigation.navigate(ROUTES.ROOM_MEMBERS.getRoute(report?.reportID ?? ''));
                    } else {
                        Navigation.navigate(ROUTES.REPORT_PARTICIPANTS.getRoute(report?.reportID ?? ''));
                    }
                },
            });
        } else if (
            (isUserCreatedPolicyRoom && (!participants.length || !isPolicyEmployee)) ||
            ((isDefaultRoom || ReportUtils.isPolicyExpenseChat(report)) && isChatThread && !isPolicyEmployee)
        ) {
            items.push({
                key: CONST.REPORT_DETAILS_MENU_ITEM.INVITE,
                translationKey: 'common.invite',
                icon: Expensicons.Users,
                isAnonymousAction: false,
                action: () => {
                    Navigation.navigate(ROUTES.ROOM_INVITE.getRoute(report?.reportID ?? ''));
                },
            });
        }

        items.push({
            key: CONST.REPORT_DETAILS_MENU_ITEM.SETTINGS,
            translationKey: 'common.settings',
            icon: Expensicons.Gear,
            isAnonymousAction: false,
            action: () => {
                Navigation.navigate(ROUTES.REPORT_SETTINGS.getRoute(report?.reportID ?? ''));
            },
        });

        // Prevent displaying private notes option for threads and task reports
        if (!isChatThread && !isMoneyRequestReport && !isInvoiceReport && !ReportUtils.isTaskReport(report)) {
            items.push({
                key: CONST.REPORT_DETAILS_MENU_ITEM.PRIVATE_NOTES,
                translationKey: 'privateNotes.title',
                icon: Expensicons.Pencil,
                isAnonymousAction: false,
                action: () => ReportUtils.navigateToPrivateNotes(report, session),
                brickRoadIndicator: Report.hasErrorInPrivateNotes(report) ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
            });
        }

        return items;
    }, [
        isSelfDM,
        isArchivedRoom,
        isGroupChat,
        isDefaultRoom,
        isChatThread,
        isPolicyEmployee,
        isUserCreatedPolicyRoom,
        participants.length,
        report,
        isMoneyRequestReport,
        isInvoiceReport,
        activeChatMembers.length,
        session,
    ]);

    const displayNamesWithTooltips = useMemo(() => {
        const hasMultipleParticipants = participants.length > 1;
        return ReportUtils.getDisplayNamesWithTooltips(OptionsListUtils.getPersonalDetailsForAccountIDs(participants, personalDetails), hasMultipleParticipants);
    }, [participants, personalDetails]);

    const icons = useMemo(() => ReportUtils.getIcons(report, personalDetails, null, '', -1, policy), [report, personalDetails, policy]);

    const chatRoomSubtitleText = chatRoomSubtitle ? (
        <DisplayNames
            fullTitle={chatRoomSubtitle}
            tooltipEnabled
            numberOfLines={1}
            textStyles={[styles.sidebarLinkText, styles.textLabelSupporting, styles.pre, styles.mt1, styles.textAlignCenter]}
            shouldUseFullTitle
        />
    ) : null;

    const renderAvatar =
        isGroupChat && !isThread ? (
            <AvatarWithImagePicker
                source={icons[0].source}
                isUsingDefaultAvatar={!report.avatarUrl}
                size={CONST.AVATAR_SIZE.XLARGE}
                avatarStyle={styles.avatarXLarge}
                shouldDisableViewPhoto
                onImageRemoved={() => {
                    // Calling this without a file will remove the avatar
                    Report.updateGroupChatAvatar(report.reportID ?? '');
                }}
                onImageSelected={(file) => Report.updateGroupChatAvatar(report.reportID ?? '', file)}
                editIcon={Expensicons.Camera}
                editIconStyle={styles.smallEditIconAccount}
                pendingAction={report.pendingFields?.avatar ?? undefined}
                errors={report.errorFields?.avatar ?? null}
                errorRowStyles={styles.mt6}
                onErrorClose={() => Report.clearAvatarErrors(report.reportID ?? '')}
            />
        ) : (
            <RoomHeaderAvatars
                icons={icons}
                reportID={report?.reportID}
            />
        );

    const linkedWorkspace = useMemo(() => Object.values(policies ?? {}).find((pol) => pol && pol.id === report?.policyID) ?? null, [policies, report?.policyID]);
    const shouldDisableRename = useMemo(() => ReportUtils.shouldDisableRename(report, linkedWorkspace), [report, linkedWorkspace]);

    const chatRoomAdminSubtitleText = `${translate('reportDetailsPage.in')} ${report.policyName}`;

    const reportName =
        ReportUtils.isDeprecatedGroupDM(report) || ReportUtils.isGroupChat(report)
            ? ReportUtils.getGroupChatName(undefined, false, report.reportID ?? '')
            : ReportUtils.getReportName(report);

    const nameSectionExpenseIOU = (
        <View style={[styles.reportDetailsRoomInfo, styles.mw100]}>
            <View style={[styles.alignSelfCenter, styles.w100, styles.mt1]}>
                <DisplayNames
                    fullTitle={reportName ?? ''}
                    displayNamesWithTooltips={displayNamesWithTooltips}
                    tooltipEnabled
                    numberOfLines={isChatRoom && !isChatThread ? 0 : 1}
                    textStyles={[styles.textHeadline, styles.textAlignCenter, isChatRoom && !isChatThread ? undefined : styles.pre]}
                    shouldUseFullTitle={shouldUseFullTitle}
                />
            </View>
            {!isEmptyObject(parentNavigationSubtitleData) && (isMoneyRequestReport || isInvoiceReport || isMoneyRequest) && (
                <ParentNavigationSubtitle
                    parentNavigationSubtitleData={parentNavigationSubtitleData}
                    parentReportID={report?.parentReportID}
                    parentReportActionID={report?.parentReportActionID}
                    pressableStyles={[styles.mt1, styles.mw100]}
                />
            )}
        </View>
    );

    const nameSectionGroupWorkspace = (
        <OfflineWithFeedback
            pendingAction={report?.pendingFields?.reportName}
            errors={report?.errorFields?.reportName}
            errorRowStyles={[styles.ph5]}
            onClose={() => Report.clearPolicyRoomNameErrors(report.reportID)}
        >
            <MenuItemWithTopDescription
                shouldShowRightIcon={!shouldDisableRename}
                title={reportName ?? ''}
                style={[isPolicy ? styles.pb1 : undefined]}
                titleStyle={styles.textHeadline}
                description={isGroupChat ? translate('common.name') : translate('newRoomPage.roomName')}
                onPress={() =>
                    isGroupChat
                        ? Navigation.navigate(ROUTES.REPORT_SETTINGS_GROUP_NAME.getRoute(report.reportID))
                        : Navigation.navigate(ROUTES.REPORT_SETTINGS_ROOM_NAME.getRoute(report.reportID))
                }
                disabled={shouldDisableRename}
                shouldGreyOutWhenDisabled={false}
            />

            {isPolicyAdmin ? (
                <PressableWithoutFeedback
                    style={[styles.w100, styles.ph5, styles.pb3]}
                    disabled={policy?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE}
                    role={CONST.ROLE.BUTTON}
                    accessibilityLabel={chatRoomSubtitle ?? ''}
                    accessible
                    onPress={() => {
                        Navigation.navigate(ROUTES.WORKSPACE_INITIAL.getRoute(report?.policyID ?? ''));
                    }}
                >
                    <Text style={[styles.textLabelSupporting]}>{chatRoomAdminSubtitleText}</Text>
                </PressableWithoutFeedback>
            ) : (
                <View style={[styles.w100, styles.ph5, styles.pb3]}>
                    <Text style={[styles.textLabelSupporting]}>{chatRoomSubtitleText}</Text>
                </View>
            )}
        </OfflineWithFeedback>
    );

    const shouldShowLeaveButton = !isDefaultRoom && !isExpenseReport;

    return (
        <ScreenWrapper testID={ReportDetailsPage.displayName}>
            <FullPageNotFoundView shouldShow={isEmptyObject(report)}>
                <HeaderWithBackButton
                    title={translate('common.details')}
                    onBackButtonPress={Navigation.goBack}
                    shouldNavigateToTopMostReport={!(route.params && 'backTo' in route.params)}
                />
                <ScrollView style={[styles.flex1]}>
                    <View style={[styles.reportDetailsTitleContainer, !isExpenseReport ? styles.pb0 : styles.pb2]}>
                        <View style={styles.mb3}>
                            {isMoneyRequestReport || isInvoiceReport ? (
                                <MultipleAvatars
                                    icons={icons}
                                    size={CONST.AVATAR_SIZE.LARGE}
                                />
                            ) : (
                                renderAvatar
                            )}
                        </View>
                        {isExpenseReport && nameSectionExpenseIOU}
                    </View>

                    {!isExpenseReport && nameSectionGroupWorkspace}

                    {shouldShowReportDescription && (
                        <OfflineWithFeedback pendingAction={report.pendingFields?.description}>
                            <MenuItemWithTopDescription
                                shouldShowRightIcon={canEditReportDescription}
                                interactive={canEditReportDescription}
                                title={report.description}
                                shouldRenderAsHTML
                                shouldCheckActionAllowedOnPress={false}
                                description={translate('reportDescriptionPage.roomDescription')}
                                onPress={() => Navigation.navigate(ROUTES.REPORT_DESCRIPTION.getRoute(report.reportID))}
                            />
                        </OfflineWithFeedback>
                    )}

                    <View style={[styles.mt5]}>
                        <PromotedActionsBar
                            report={report}
                            promotedActions={[PromotedActions.join, PromotedActions.pin, PromotedActions.share]}
                            shouldShowLeaveButton={false}
                        />
                    </View>

                    {menuItems.map((item) => {
                        const brickRoadIndicator =
                            ReportUtils.hasReportNameError(report) && item.key === CONST.REPORT_DETAILS_MENU_ITEM.SETTINGS ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined;
                        return (
                            <MenuItem
                                key={item.key}
                                title={translate(item.translationKey)}
                                subtitle={item.subtitle}
                                icon={item.icon}
                                onPress={item.action}
                                isAnonymousAction={item.isAnonymousAction}
                                shouldShowRightIcon
                                brickRoadIndicator={brickRoadIndicator ?? item.brickRoadIndicator}
                            />
                        );
                    })}

                    {shouldShowLeaveButton && (
                        <MenuItem
                            key={CONST.REPORT_DETAILS_MENU_ITEM.LEAVE_ROOM}
                            title={translate('common.leave')}
                            icon={Expensicons.Exit}
                            isAnonymousAction={false}
                            shouldShowRightIcon={false}
                            onPress={() => {
                                if (Object.keys(report?.participants ?? {}).length === 1) {
                                    setIsLastMemberLeavingGroupModalVisible(true);
                                    return;
                                }

                                Report.leaveGroupChat(report.reportID);
                            }}
                        />
                    )}

                    <ConfirmModal
                        danger
                        title={translate('groupChat.lastMemberTitle')}
                        isVisible={isLastMemberLeavingGroupModalVisible}
                        onConfirm={() => {
                            setIsLastMemberLeavingGroupModalVisible(false);
                            Report.leaveGroupChat(report.reportID);
                        }}
                        onCancel={() => setIsLastMemberLeavingGroupModalVisible(false)}
                        prompt={translate('groupChat.lastMemberWarning')}
                        confirmText={translate('common.leave')}
                        cancelText={translate('common.cancel')}
                    />
                </ScrollView>
            </FullPageNotFoundView>
        </ScreenWrapper>
    );
}

ReportDetailsPage.displayName = 'ReportDetailsPage';

export default withReportOrNotFound()(
    withOnyx<ReportDetailsPageProps, ReportDetailsPageOnyxProps>({
        personalDetails: {
            key: ONYXKEYS.PERSONAL_DETAILS_LIST,
        },
        session: {
            key: ONYXKEYS.SESSION,
        },
    })(ReportDetailsPage),
);
