import PropTypes from 'prop-types';
import React from 'react';
import VideoPlayer from '@components/VideoPlayer';
import useWindowDimensions from '@hooks/useWindowDimensions';

const propTypes = {
    /** Video file source URL */
    source: PropTypes.string.isRequired,

    /** Whether the video is currently being hovered over */
    isHovered: PropTypes.bool,

    shouldUseSharedVideoElement: PropTypes.bool,
};

const defaultProps = {
    isHovered: false,
    shouldUseSharedVideoElement: false,
};

function AttachmentViewVideo({source, isHovered, shouldUseSharedVideoElement}) {
    const {isSmallScreenWidth} = useWindowDimensions();

    return (
        <VideoPlayer
            url={source}
            shouldUseSharedVideoElement={shouldUseSharedVideoElement && !isSmallScreenWidth}
            isVideoHovered={isHovered}
        />
    );
}

AttachmentViewVideo.propTypes = propTypes;
AttachmentViewVideo.defaultProps = defaultProps;
AttachmentViewVideo.displayName = 'AttachmentViewVideo';

export default React.memo(AttachmentViewVideo);
