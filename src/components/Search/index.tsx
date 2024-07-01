import {useNavigation} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import {useOnyx} from 'react-native-onyx';
import SelectionList from '@components/SelectionList';
import SearchTableHeader from '@components/SelectionList/SearchTableHeader';
import type {ReportListItemType, TransactionListItemType} from '@components/SelectionList/types';
import TableListItemSkeleton from '@components/Skeletons/TableListItemSkeleton';
import useNetwork from '@hooks/useNetwork';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import * as SearchActions from '@libs/actions/Search';
import * as DeviceCapabilities from '@libs/DeviceCapabilities';
import Log from '@libs/Log';
import * as ReportUtils from '@libs/ReportUtils';
import type {SearchColumnType, SortOrder} from '@libs/SearchUtils';
import * as SearchUtils from '@libs/SearchUtils';
import Navigation from '@navigation/Navigation';
import type {AuthScreensParamList} from '@navigation/types';
import EmptySearchView from '@pages/Search/EmptySearchView';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SearchResults from '@src/types/onyx/SearchResults';
import type {SearchQuery, SelectedTransactions} from '@src/types/onyx/SearchResults';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import isLoadingOnyxValue from '@src/types/utils/isLoadingOnyxValue';
import SearchHeader from './SearchHeader';

type SearchProps = {
    query: SearchQuery;
    policyIDs?: string;
    sortBy?: SearchColumnType;
    sortOrder?: SortOrder;
};

const sortableSearchTabs: SearchQuery[] = [CONST.SEARCH.TAB.ALL];
const transactionItemMobileHeight = 100;
const reportItemTransactionHeight = 52;
const listItemPadding = 12; // this is equivalent to 'mb3' on every transaction/report list item
const searchHeaderHeight = 54;

function isTransactionListItemType(item: TransactionListItemType | ReportListItemType): item is TransactionListItemType {
    const transactionListItem = item as TransactionListItemType;
    return transactionListItem.transactionID !== undefined;
}

function Search({query, policyIDs, sortBy, sortOrder}: SearchProps) {
    const [selectedItems, setSelectedItems] = useState<SelectedTransactions>({});
    const {isOffline} = useNetwork();
    const styles = useThemeStyles();
    const {isLargeScreenWidth} = useWindowDimensions();
    const navigation = useNavigation<StackNavigationProp<AuthScreensParamList>>();
    const lastSearchResultsRef = useRef<OnyxEntry<SearchResults>>();

    useEffect(() => {
        setSelectedItems({});
    }, [query, policyIDs]);

    const getItemHeight = useCallback(
        (item: TransactionListItemType | ReportListItemType) => {
            if (isTransactionListItemType(item)) {
                return isLargeScreenWidth ? variables.optionRowHeight + listItemPadding : transactionItemMobileHeight + listItemPadding;
            }

            if (item.transactions.length === 0) {
                return 0;
            }

            if (item.transactions.length === 1) {
                return isLargeScreenWidth ? variables.optionRowHeight + listItemPadding : transactionItemMobileHeight + listItemPadding;
            }

            const baseReportItemHeight = isLargeScreenWidth ? 72 : 108;
            return baseReportItemHeight + item.transactions.length * reportItemTransactionHeight + listItemPadding;
        },
        [isLargeScreenWidth],
    );

    const hash = SearchUtils.getQueryHash(query, policyIDs, sortBy, sortOrder);
    const [currentSearchResults, searchResultsMeta] = useOnyx(`${ONYXKEYS.COLLECTION.SNAPSHOT}${hash}`);

    // save last non-empty search results to avoid ugly flash of loading screen when hash changes and onyx returns empty data
    if (currentSearchResults?.data && currentSearchResults !== lastSearchResultsRef.current) {
        lastSearchResultsRef.current = currentSearchResults;
    }

    const searchResults = currentSearchResults?.data ? currentSearchResults : lastSearchResultsRef.current;

    useEffect(() => {
        if (isOffline) {
            return;
        }

        SearchActions.search({hash, query, policyIDs, offset: 0, sortBy, sortOrder});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hash, isOffline]);

    const isLoadingItems = (!isOffline && isLoadingOnyxValue(searchResultsMeta)) || searchResults?.data === undefined;
    const isLoadingMoreItems = !isLoadingItems && searchResults?.search?.isLoading && searchResults?.search?.offset > 0;
    const shouldShowEmptyState = !isLoadingItems && isEmptyObject(searchResults?.data);

    if (isLoadingItems) {
        return <TableListItemSkeleton shouldAnimate />;
    }

    if (shouldShowEmptyState) {
        return <EmptySearchView />;
    }

    const openReport = (item: TransactionListItemType | ReportListItemType) => {
        let reportID = isTransactionListItemType(item) ? item.transactionThreadReportID : item.reportID;

        if (!reportID) {
            return;
        }

        // If we're trying to open a legacy transaction without a transaction thread, let's create the thread and navigate the user
        if (isTransactionListItemType(item) && reportID === '0' && item.moneyRequestReportActionID) {
            reportID = ReportUtils.generateReportID();
            SearchActions.createTransactionThread(hash, item.transactionID, reportID, item.moneyRequestReportActionID);
        }

        Navigation.navigate(ROUTES.SEARCH_REPORT.getRoute(query, reportID));
    };

    const fetchMoreResults = () => {
        if (!searchResults?.search?.hasMoreResults || isLoadingItems || isLoadingMoreItems) {
            return;
        }
        const currentOffset = searchResults?.search?.offset ?? 0;
        SearchActions.search({hash, query, offset: currentOffset + CONST.SEARCH.RESULTS_PAGE_SIZE, sortBy, sortOrder});
    };

    const type = SearchUtils.getSearchType(searchResults?.search);

    if (type === undefined) {
        Log.alert('[Search] Undefined search type');
        return null;
    }

    const ListItem = SearchUtils.getListItem(type);
    
    const data = SearchUtils.getSections(searchResults?.data ?? {}, searchResults?.search ?? {}, type);
    const sortedData = SearchUtils.getSortedSections(type, data, sortBy, sortOrder);

    const onSortPress = (column: SearchColumnType, order: SortOrder) => {
        navigation.setParams({
            sortBy: column,
            sortOrder: order,
        });
    };

    const isSortingAllowed = sortableSearchTabs.includes(query);

    const shouldShowYear = SearchUtils.shouldShowYear(searchResults?.data);

    const toggleTransaction = (item: TransactionListItemType | ReportListItemType) => {
        if (isTransactionListItemType(item)) {
            if (!item.keyForList) {
                return;
            }

            setSelectedItems((prev) => {
                if (prev[item.keyForList]?.isSelected) {
                    const {[item.keyForList]: omittedTransaction, ...transactions} = prev;
                    return transactions;
                }
                return {...prev, [item.keyForList]: {isSelected: true, canDelete: item.canDelete, action: item.action}};
            });

            return;
        }

        if (item.transactions.every((transaction) => selectedItems[transaction.keyForList]?.isSelected)) {
            const reducedSelectedItems = item.transactions.reduce((acc: SelectedTransactions, currentTransaction) => {
                if (!selectedItems[currentTransaction.keyForList]) {
                    acc[currentTransaction.keyForList] = selectedItems[currentTransaction.keyForList];
                }
                return acc;
            }, {});

            setSelectedItems(reducedSelectedItems);
            return;
        }

        setSelectedItems(
            Object.fromEntries(item.transactions.map((transaction) => [transaction.keyForList, {isSelected: true, canDelete: transaction.canDelete, action: transaction.action}])),
        );
    };

    const toggleAllTransactions = () => {
        const areReportItems = searchResults.search.type === 'report';
        const flattenedItems = areReportItems ? (sortedData as ReportListItemType[]).flatMap((item) => item.transactions) : sortedData;
        const isAllSelected = flattenedItems.length === Object.keys(selectedItems).length;

        if (isAllSelected) {
            setSelectedItems({});
            return;
        }

        if (areReportItems) {
            setSelectedItems(
                Object.fromEntries(
                    (sortedData as ReportListItemType[]).flatMap((item) =>
                        item.transactions.map((transaction: TransactionListItemType) => [
                            transaction.keyForList,
                            {isSelected: true, canDelete: transaction.canDelete, action: transaction.action},
                        ]),
                    ),
                ),
            );

            return;
        }

        setSelectedItems(Object.fromEntries((sortedData as TransactionListItemType[]).map((item) => [item.keyForList, {isSelected: true, canDelete: item.canDelete, action: item.action}])));
    };

    const mapToSelectedTransactionItem = (item: TransactionListItemType) => ({...item, isSelected: !!selectedItems[item.keyForList]?.isSelected});

    const sortedSelectedData = sortedData.map((item) =>
        isTransactionListItemType(item)
            ? mapToSelectedTransactionItem(item)
            : {
                  ...item,
                  transactions: item.transactions?.map(mapToSelectedTransactionItem),
                  isSelected: item.transactions.every((transaction) => !!selectedItems[transaction.keyForList]?.isSelected),
              },
    );

    return (
        <>
            <SearchHeader
                selectedItems={selectedItems}
                query={query}
                hash={hash}
            />
            <SelectionList<ReportListItemType | TransactionListItemType>
                customListHeader={
                    <SearchTableHeader
                        data={searchResults?.data}
                        metadata={searchResults?.search}
                        onSortPress={onSortPress}
                        sortOrder={sortOrder}
                        isSortingAllowed={isSortingAllowed}
                        sortBy={sortBy}
                        shouldShowYear={shouldShowYear}
                    />
                }
                canSelectMultiple={isLargeScreenWidth}
                onSelectAll={toggleAllTransactions}
                onCheckboxPress={toggleTransaction}
                customListHeaderHeight={searchHeaderHeight}
                // To enhance the smoothness of scrolling and minimize the risk of encountering blank spaces during scrolling,
                // we have configured a larger windowSize and a longer delay between batch renders.
                // The windowSize determines the number of items rendered before and after the currently visible items.
                // A larger windowSize helps pre-render more items, reducing the likelihood of blank spaces appearing.
                // The updateCellsBatchingPeriod sets the delay (in milliseconds) between rendering batches of cells.
                // A longer delay allows the UI to handle rendering in smaller increments, which can improve performance and smoothness.
                // For more information, refer to the React Native documentation:
                // https://reactnative.dev/docs/0.73/optimizing-flatlist-configuration#windowsize
                // https://reactnative.dev/docs/0.73/optimizing-flatlist-configuration#updatecellsbatchingperiod
                windowSize={111}
                updateCellsBatchingPeriod={200}
                ListItem={ListItem}
                sections={[{data: sortedSelectedData, isDisabled: false}]}
                onSelectRow={(item) => openReport(item)}
                getItemHeight={getItemHeight}
                shouldDebounceRowSelect
                shouldPreventDefaultFocusOnSelectRow={!DeviceCapabilities.canUseTouchScreen()}
                listHeaderWrapperStyle={[styles.ph9, styles.pv3, styles.pb5]}
                containerStyle={[styles.pv0]}
                showScrollIndicator={false}
                onEndReachedThreshold={0.75}
                onEndReached={fetchMoreResults}
                listFooterContent={
                    isLoadingMoreItems ? (
                        <TableListItemSkeleton
                            shouldAnimate
                            fixedNumItems={5}
                        />
                    ) : undefined
                }
            />
        </>
    );
}

Search.displayName = 'Search';

export type {SearchProps};
export default Search;
