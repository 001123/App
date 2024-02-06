import React, {memo, useMemo} from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import {withOnyx} from 'react-native-onyx';
import GoogleMeetIcon from '@assets/images/google-meet.svg';
import ZoomIcon from '@assets/images/zoom-icon.svg';
import Button from '@components/Button';
import ConfirmModal from '@components/ConfirmModal';
import DisplayNames from '@components/DisplayNames';
import type {ThreeDotsMenuItem} from '@components/HeaderWithBackButton/types';
import Icon from '@components/Icon';
import * as Expensicons from '@components/Icon/Expensicons';
import MultipleAvatars from '@components/MultipleAvatars';
import ParentNavigationSubtitle from '@components/ParentNavigationSubtitle';
import PressableWithoutFeedback from '@components/Pressable/PressableWithoutFeedback';
import ReportHeaderSkeletonView from '@components/ReportHeaderSkeletonView';
import SubscriptAvatar from '@components/SubscriptAvatar';
import TaskHeaderActionButton from '@components/TaskHeaderActionButton';
import Text from '@components/Text';
import ThreeDotsMenu from '@components/ThreeDotsMenu';
import Tooltip from '@components/Tooltip';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import {getGroupChatName} from '@libs/GroupChatUtils';
import * as HeaderUtils from '@libs/HeaderUtils';
import type {ReportWithoutHasDraft} from '@libs/OnyxSelectors/reportWithoutHasDraftSelector';
import reportWithoutHasDraftSelector from '@libs/OnyxSelectors/reportWithoutHasDraftSelector';
import * as OptionsListUtils from '@libs/OptionsListUtils';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import * as ReportUtils from '@libs/ReportUtils';
import * as Link from '@userActions/Link';
import * as Report from '@userActions/Report';
import * as Session from '@userActions/Session';
import * as Task from '@userActions/Task';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import type {EmptyObject} from '@src/types/utils/EmptyObject';
import {isEmptyObject} from '@src/types/utils/EmptyObject';

type PickedPolicyValues = Pick<OnyxTypes.Policy, 'name' | 'avatar' | 'pendingAction'>;

type HeaderViewOnyxProps = {
    /** URL to the assigned guide's appointment booking calendar */
    guideCalendarLink: OnyxEntry<string>;

    /** Current user session */
    session: OnyxEntry<OnyxTypes.Session>;

    /** Personal details of all the users */
    personalDetails: OnyxEntry<OnyxTypes.PersonalDetailsList>;

    /** Parent report */
    parentReport: OnyxEntry<ReportWithoutHasDraft>;

    /** The current policy of the report */
    policy: PickedPolicyValues | EmptyObject;
};

type HeaderViewProps = HeaderViewOnyxProps & {
    /** Toggles the navigationMenu open and closed */
    onNavigationMenuButtonClicked: () => void;

    /** The report currently being looked at */
    report: OnyxTypes.Report;

    /** The reportID of the request */
    reportID: string;
};

function HeaderView({report, personalDetails, parentReport, policy, session, reportID, guideCalendarLink, onNavigationMenuButtonClicked}: HeaderViewProps) {
    const [isDeleteTaskConfirmModalVisible, setIsDeleteTaskConfirmModalVisible] = React.useState(false);
    const {isSmallScreenWidth, windowWidth} = useWindowDimensions();
    const {translate} = useLocalize();
    const theme = useTheme();
    const styles = useThemeStyles();
    const participants = report.participantAccountIDs ?? [];
    const participantPersonalDetails = OptionsListUtils.getPersonalDetailsForAccountIDs(participants, personalDetails);
    const isMultipleParticipant = participants.length > 1;
    const displayNamesWithTooltips = ReportUtils.getDisplayNamesWithTooltips(participantPersonalDetails, isMultipleParticipant);
    const isChatThread = ReportUtils.isChatThread(report);
    const isChatRoom = ReportUtils.isChatRoom(report);
    const isPolicyExpenseChat = ReportUtils.isPolicyExpenseChat(report);
    const isTaskReport = ReportUtils.isTaskReport(report);
    const reportHeaderData = !isTaskReport && !isChatThread && report.parentReportID ? parentReport : report;
    // Use sorted display names for the title for group chats on native small screen widths
    const title = ReportUtils.isGroupChat(report) ? getGroupChatName(report) : ReportUtils.getReportName(reportHeaderData);
    const subtitle = ReportUtils.getChatRoomSubtitle(reportHeaderData);
    const parentNavigationSubtitleData = ReportUtils.getParentNavigationSubtitle(reportHeaderData);
    const isConcierge = ReportUtils.hasSingleParticipant(report) && participants.includes(CONST.ACCOUNT_ID.CONCIERGE);
    const isAutomatedExpensifyAccount = ReportUtils.hasSingleParticipant(report) && ReportUtils.hasAutomatedExpensifyAccountIDs(participants);
    const parentReportAction = ReportActionsUtils.getParentReportAction(report);
    const isCanceledTaskReport = ReportUtils.isCanceledTaskReport(report, parentReportAction);
    const isWhisperAction = ReportActionsUtils.isWhisperAction(parentReportAction);
    const isUserCreatedPolicyRoom = ReportUtils.isUserCreatedPolicyRoom(report);
    const isPolicyMember = useMemo(() => !isEmptyObject(policy), [policy]);
    const canLeaveRoom = ReportUtils.canLeaveRoom(report, isPolicyMember);
    const isArchivedRoom = ReportUtils.isArchivedRoom(report);

    // We hide the button when we are chatting with an automated Expensify account since it's not possible to contact
    // these users via alternative means. It is possible to request a call with Concierge so we leave the option for them.
    const threeDotMenuItems: ThreeDotsMenuItem[] = [];
    if (isTaskReport && !isCanceledTaskReport) {
        const canModifyTask = Task.canModifyTask(report, session?.accountID ?? -1);

        // Task is marked as completed
        if (ReportUtils.isCompletedTaskReport(report) && canModifyTask) {
            threeDotMenuItems.push({
                icon: Expensicons.Checkmark,
                text: translate('task.markAsIncomplete'),
                onSelected: Session.checkIfActionIsAllowed(() => Task.reopenTask(report)),
            });
        }

        // Task is not closed
        if (report.stateNum !== CONST.REPORT.STATE_NUM.APPROVED && report.statusNum !== CONST.REPORT.STATUS_NUM.CLOSED && canModifyTask) {
            threeDotMenuItems.push({
                icon: Expensicons.Trashcan,
                text: translate('common.delete'),
                onSelected: () => setIsDeleteTaskConfirmModalVisible(true),
            });
        }
    }

    const join = Session.checkIfActionIsAllowed(() =>
        Report.updateNotificationPreference(reportID, report.notificationPreference, CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS, false, report.parentReportID, report.parentReportActionID),
    );

    const canJoinOrLeave = isChatThread || isUserCreatedPolicyRoom || canLeaveRoom;
    const canJoin = canJoinOrLeave && !isWhisperAction && report.notificationPreference === CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN;
    const canLeave = canJoinOrLeave && ((isChatThread && !!report.notificationPreference?.length) || isUserCreatedPolicyRoom || canLeaveRoom);
    if (canJoin) {
        threeDotMenuItems.push({
            icon: Expensicons.ChatBubbles,
            text: translate('common.join'),
            onSelected: join,
        });
    } else if (canLeave) {
        const isWorkspaceMemberLeavingWorkspaceRoom = !isChatThread && report.visibility === CONST.REPORT.VISIBILITY.RESTRICTED && isPolicyMember;
        threeDotMenuItems.push({
            icon: Expensicons.ChatBubbles,
            text: translate('common.leave'),
            onSelected: Session.checkIfActionIsAllowed(() => Report.leaveRoom(reportID, isWorkspaceMemberLeavingWorkspaceRoom)),
        });
    }

    const joinButton = (
        <Button
            success
            medium
            text={translate('common.join')}
            onPress={join}
        />
    );

    threeDotMenuItems.push(HeaderUtils.getPinMenuItem(report));

    if (isConcierge && guideCalendarLink) {
        threeDotMenuItems.push({
            icon: Expensicons.Phone,
            text: translate('videoChatButtonAndMenu.tooltip'),
            onSelected: Session.checkIfActionIsAllowed(() => {
                Link.openExternalLink(guideCalendarLink);
            }),
        });
    } else if (!isAutomatedExpensifyAccount && !isTaskReport && !isArchivedRoom) {
        threeDotMenuItems.push({
            icon: ZoomIcon,
            text: translate('videoChatButtonAndMenu.zoom'),
            onSelected: Session.checkIfActionIsAllowed(() => {
                Link.openExternalLink(CONST.NEW_ZOOM_MEETING_URL);
            }),
        });
        threeDotMenuItems.push({
            icon: GoogleMeetIcon,
            text: translate('videoChatButtonAndMenu.googleMeet'),
            onSelected: Session.checkIfActionIsAllowed(() => {
                Link.openExternalLink(CONST.NEW_GOOGLE_MEET_MEETING_URL);
            }),
        });
    }

    const shouldShowThreeDotsButton = !!threeDotMenuItems.length;

    const shouldShowSubscript = ReportUtils.shouldReportShowSubscript(report);
    const defaultSubscriptSize = ReportUtils.isExpenseRequest(report) ? CONST.AVATAR_SIZE.SMALL_NORMAL : CONST.AVATAR_SIZE.DEFAULT;
    const icons = ReportUtils.getIcons(reportHeaderData, personalDetails);
    const brickRoadIndicator = ReportUtils.hasReportNameError(report) ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : '';
    const shouldShowBorderBottom = !isTaskReport || !isSmallScreenWidth;
    const shouldDisableDetailPage = ReportUtils.shouldDisableDetailPage(report);

    const isLoading = !report.reportID || !title;

    return (
        <View
            style={[shouldShowBorderBottom && styles.borderBottom]}
            dataSet={{dragArea: true}}
        >
            <View style={[styles.appContentHeader]}>
                <View style={[styles.appContentHeaderTitle, !isSmallScreenWidth && styles.pl5]}>
                    {isLoading ? (
                        <ReportHeaderSkeletonView onBackButtonPress={onNavigationMenuButtonClicked} />
                    ) : (
                        <>
                            {isSmallScreenWidth && (
                                <PressableWithoutFeedback
                                    onPress={onNavigationMenuButtonClicked}
                                    style={[styles.LHNToggle]}
                                    accessibilityHint={translate('accessibilityHints.navigateToChatsList')}
                                    accessibilityLabel={translate('common.back')}
                                    role={CONST.ROLE.BUTTON}
                                >
                                    <Tooltip
                                        text={translate('common.back')}
                                        shiftVertical={4}
                                    >
                                        <View>
                                            <Icon
                                                src={Expensicons.BackArrow}
                                                fill={theme.icon}
                                            />
                                        </View>
                                    </Tooltip>
                                </PressableWithoutFeedback>
                            )}
                            <View style={[styles.flex1, styles.flexRow, styles.alignItemsCenter, styles.justifyContentBetween]}>
                                <PressableWithoutFeedback
                                    onPress={() => ReportUtils.navigateToDetailsPage(report)}
                                    style={[styles.flexRow, styles.alignItemsCenter, styles.flex1]}
                                    disabled={shouldDisableDetailPage}
                                    accessibilityLabel={title}
                                    role={CONST.ROLE.BUTTON}
                                >
                                    {shouldShowSubscript ? (
                                        <SubscriptAvatar
                                            mainAvatar={icons[0]}
                                            secondaryAvatar={icons[1]}
                                            size={defaultSubscriptSize}
                                        />
                                    ) : (
                                        <MultipleAvatars
                                            icons={icons}
                                            shouldShowTooltip={!isChatRoom || isChatThread}
                                        />
                                    )}
                                    <View style={[styles.flex1, styles.flexColumn]}>
                                        <DisplayNames
                                            fullTitle={title}
                                            displayNamesWithTooltips={displayNamesWithTooltips}
                                            tooltipEnabled
                                            numberOfLines={1}
                                            textStyles={[styles.headerText, styles.pre]}
                                            shouldUseFullTitle={isChatRoom || isPolicyExpenseChat || isChatThread || isTaskReport}
                                        />
                                        {!isEmptyObject(parentNavigationSubtitleData) && (
                                            <ParentNavigationSubtitle
                                                parentNavigationSubtitleData={parentNavigationSubtitleData}
                                                parentReportID={report.parentReportID}
                                                pressableStyles={[styles.alignSelfStart, styles.mw100]}
                                            />
                                        )}
                                        {!!subtitle && (
                                            <Text
                                                style={[styles.sidebarLinkText, styles.optionAlternateText, styles.textLabelSupporting]}
                                                numberOfLines={1}
                                            >
                                                {subtitle}
                                            </Text>
                                        )}
                                    </View>
                                    {brickRoadIndicator === CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR && (
                                        <View style={[styles.alignItemsCenter, styles.justifyContentCenter]}>
                                            <Icon
                                                src={Expensicons.DotIndicator}
                                                fill={theme.danger}
                                            />
                                        </View>
                                    )}
                                </PressableWithoutFeedback>
                                <View style={[styles.reportOptions, styles.flexRow, styles.alignItemsCenter]}>
                                    {isTaskReport && !isSmallScreenWidth && ReportUtils.isOpenTaskReport(report) && <TaskHeaderActionButton report={report} />}
                                    {canJoin && !isSmallScreenWidth && joinButton}
                                    {shouldShowThreeDotsButton && (
                                        <ThreeDotsMenu
                                            anchorPosition={styles.threeDotsPopoverOffset(windowWidth)}
                                            menuItems={threeDotMenuItems}
                                            shouldSetModalVisibility={false}
                                        />
                                    )}
                                </View>
                            </View>
                            <ConfirmModal
                                isVisible={isDeleteTaskConfirmModalVisible}
                                onConfirm={() => {
                                    setIsDeleteTaskConfirmModalVisible(false);
                                    Session.checkIfActionIsAllowed(Task.deleteTask(reportID, report.reportName ?? '', report.stateNum ?? 0, report.statusNum ?? 0));
                                }}
                                onCancel={() => setIsDeleteTaskConfirmModalVisible(false)}
                                title={translate('task.deleteTask')}
                                prompt={translate('task.deleteConfirmation')}
                                confirmText={translate('common.delete')}
                                cancelText={translate('common.cancel')}
                                danger
                            />
                        </>
                    )}
                </View>
            </View>
            {!isLoading && canJoin && isSmallScreenWidth && <View style={[styles.ph5, styles.pb2]}>{joinButton}</View>}
        </View>
    );
}

HeaderView.displayName = 'HeaderView';

export default memo(
    withOnyx<HeaderViewProps, HeaderViewOnyxProps>({
        guideCalendarLink: {
            key: ONYXKEYS.ACCOUNT,
            selector: (account) => account?.guideCalendarLink ?? null,
            initialValue: null,
        },
        parentReport: {
            key: ({report}) => `${ONYXKEYS.COLLECTION.REPORT}${report?.parentReportID ?? report?.reportID}`,
            selector: reportWithoutHasDraftSelector,
        },
        session: {
            key: ONYXKEYS.SESSION,
        },
        policy: {
            key: ({report}) => `${ONYXKEYS.COLLECTION.POLICY}${report ? report.policyID : '0'}`,
            selector: (policy: OnyxEntry<OnyxTypes.Policy>): PickedPolicyValues | EmptyObject => {
                if (!policy) {
                    return {};
                }

                const valuesToPick = ['name', 'avatar', 'pendingAction'] as const;
                return valuesToPick.reduce((values, key) => (key in policy ? {...values, [key]: policy[key]} : values), {});
            },
        },
        personalDetails: {
            key: ONYXKEYS.PERSONAL_DETAILS_LIST,
        },
    })(HeaderView),
);
