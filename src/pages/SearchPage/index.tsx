import type {StackScreenProps} from '@react-navigation/stack';
import React, {useEffect, useMemo, useState} from 'react';
import {View} from 'react-native';
import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import {withOnyx} from 'react-native-onyx';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import {usePersonalDetails} from '@components/OnyxProvider';
import ScreenWrapper from '@components/ScreenWrapper';
import SelectionList from '@components/SelectionList';
import type {ListItem} from '@components/SelectionList/types';
import useDebouncedState from '@hooks/useDebouncedState';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import type {SearchNavigatorParamList} from '@libs/Navigation/types';
import * as OptionsListUtils from '@libs/OptionsListUtils';
import Performance from '@libs/Performance';
import * as ReportUtils from '@libs/ReportUtils';
import * as Report from '@userActions/Report';
import Timing from '@userActions/Timing';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';
import SearchPageFooter from './SearchPageFooter';

type SearchPageOnyxProps = {
    /** Beta features list */
    betas: OnyxEntry<OnyxTypes.Beta[]>;

    /** All reports shared with the user */
    reports: OnyxCollection<OnyxTypes.Report>;

    /** Whether or not we are searching for reports on the server */
    isSearchingForReports: OnyxEntry<boolean>;
};

type SearchPageProps = SearchPageOnyxProps & StackScreenProps<SearchNavigatorParamList, typeof SCREENS.SEARCH_ROOT>;

type SearchPageSectionItem = {
    data: ListItem[];
    shouldShow: boolean;
    indexOffset: number;
};

type SearchPageSectionList = SearchPageSectionItem[];

const setPerformanceTimersEnd = () => {
    Timing.end(CONST.TIMING.SEARCH_RENDER);
    Performance.markEnd(CONST.TIMING.SEARCH_RENDER);
};

const SearchPageFooterInstance = <SearchPageFooter />;

function SearchPage({betas, reports, isSearchingForReports}: SearchPageProps) {
    const [isScreenTransitionEnd, setIsScreenTransitionEnd] = useState(false);
    const {translate} = useLocalize();
    const {isOffline} = useNetwork();
    const themeStyles = useThemeStyles();
    const personalDetails = usePersonalDetails();

    const offlineMessage = isOffline ? [`${translate('common.youAppearToBeOffline')} ${translate('search.resultsAreLimited')}`, {isTranslated: true}] : '';

    const [searchValue, debouncedSearchValue, setSearchValue] = useDebouncedState('');

    useEffect(() => {
        Timing.start(CONST.TIMING.SEARCH_RENDER);
        Performance.markStart(CONST.TIMING.SEARCH_RENDER);
    }, []);

    useEffect(() => {
        Report.searchInServer(debouncedSearchValue.trim());
    }, [debouncedSearchValue]);

    const {
        recentReports,
        personalDetails: localPersonalDetails,
        userToInvite,
        headerMessage,
    } = useMemo(() => {
        if (!isScreenTransitionEnd) {
            return {
                recentReports: [],
                personalDetails: [],
                userToInvite: null,
                headerMessage: '',
            };
        }
        const options = OptionsListUtils.getSearchOptions(reports, personalDetails, debouncedSearchValue.trim(), betas ?? []);
        const header = OptionsListUtils.getHeaderMessage(options.recentReports.length + options.personalDetails.length !== 0, Boolean(options.userToInvite), debouncedSearchValue);
        return {...options, headerMessage: header};
    }, [debouncedSearchValue, reports, personalDetails, betas, isScreenTransitionEnd]);

    const sections = useMemo((): SearchPageSectionList => {
        const newSections: SearchPageSectionList = [];
        let indexOffset = 0;

        if (recentReports?.length > 0) {
            newSections.push({
                data: recentReports as ListItem[],
                shouldShow: true,
                indexOffset,
            });
            indexOffset += recentReports?.length;
        }

        if (localPersonalDetails.length > 0) {
            newSections.push({
                data: localPersonalDetails as ListItem[],
                shouldShow: true,
                indexOffset,
            });
            indexOffset += recentReports.length;
        }

        if (userToInvite) {
            newSections.push({
                data: [userToInvite as ListItem],
                shouldShow: true,
                indexOffset,
            });
        }

        return newSections;
    }, [localPersonalDetails, recentReports, userToInvite]);

    const selectReport = (option: ListItem) => {
        if (!option) {
            return;
        }

        if (option.reportID) {
            setSearchValue('');
            Navigation.dismissModal(option.reportID);
        } else {
            Report.navigateToAndOpenReport(option.login ? [option.login] : []);
        }
    };

    const handleScreenTransitionEnd = () => {
        setIsScreenTransitionEnd(true);
    };

    const isOptionsDataReady = useMemo(() => ReportUtils.isReportDataReady() && OptionsListUtils.isPersonalDetailsReady(personalDetails), [personalDetails]);

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            testID={SearchPage.displayName}
            onEntryTransitionEnd={handleScreenTransitionEnd}
        >
            {({didScreenTransitionEnd, safeAreaPaddingBottomStyle}) => (
                <>
                    <HeaderWithBackButton
                        title={translate('common.search')}
                        onBackButtonPress={Navigation.goBack}
                    />
                    <View style={[themeStyles.flex1, themeStyles.w100, safeAreaPaddingBottomStyle]}>
                        <SelectionList
                            sections={didScreenTransitionEnd && isOptionsDataReady ? sections : CONST.EMPTY_ARRAY}
                            textInputValue={searchValue}
                            textInputLabel={translate('optionsSelector.nameEmailOrPhoneNumber')}
                            textInputHint={offlineMessage as string}
                            onChangeText={setSearchValue}
                            headerMessage={headerMessage}
                            onLayout={setPerformanceTimersEnd}
                            autoFocus
                            onSelectRow={selectReport}
                            showLoadingPlaceholder={!didScreenTransitionEnd || !isOptionsDataReady}
                            footerContent={SearchPageFooterInstance}
                            isLoadingNewOptions={isSearchingForReports ?? undefined}
                        />
                    </View>
                </>
            )}
        </ScreenWrapper>
    );
}

SearchPage.displayName = 'SearchPage';

export default withOnyx<SearchPageProps, SearchPageOnyxProps>({
    reports: {
        key: ONYXKEYS.COLLECTION.REPORT,
    },
    betas: {
        key: ONYXKEYS.BETAS,
    },
    isSearchingForReports: {
        key: ONYXKEYS.IS_SEARCHING_FOR_REPORTS,
        initWithStoredValues: false,
    },
})(SearchPage);
