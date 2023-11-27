import PropTypes from 'prop-types';
import React, {useCallback, useContext, useMemo, useRef, useState} from 'react';

const VideoPopoverMenuContext = React.createContext(null);

function VideoPopoverMenuContextProvider({children}) {
    const [isPopoverVisible, setIsPopoverVisible] = useState(false);
    const [anchorPosition, setAnchorPosition] = useState({vertical: 0, horizontal: 0});
    const targetVideoPlayerRef = useRef(null);

    const updateAnchorPosition = useCallback((y, x) => {
        setAnchorPosition({vertical: y, horizontal: x});
    }, []);

    const hidePopover = useCallback(() => {
        setIsPopoverVisible(false);
    }, []);

    const showPopover = useCallback(
        (ref, y = 0, x = 0) => {
            setIsPopoverVisible(true);
            updateAnchorPosition(y, x);
            targetVideoPlayerRef.current = ref;
        },
        [updateAnchorPosition],
    );

    const contextValue = useMemo(
        () => ({isPopoverVisible, hidePopover, showPopover, anchorPosition, updateAnchorPosition, targetVideoPlayerRef}),
        [anchorPosition, hidePopover, isPopoverVisible, showPopover, updateAnchorPosition, targetVideoPlayerRef],
    );
    return <VideoPopoverMenuContext.Provider value={contextValue}>{children}</VideoPopoverMenuContext.Provider>;
}

function useVideoPopoverMenuContext() {
    const context = useContext(VideoPopoverMenuContext);
    if (context === undefined) {
        throw new Error('useVideoPopoverMenuContext must be used within a PlaybackContextProvider');
    }
    return context;
}

VideoPopoverMenuContextProvider.displayName = 'VideoPopoverMenuContextProvider';
VideoPopoverMenuContextProvider.propTypes = {
    /** Actual content wrapped by this component */
    children: PropTypes.node.isRequired,
};

export {VideoPopoverMenuContextProvider, useVideoPopoverMenuContext};
