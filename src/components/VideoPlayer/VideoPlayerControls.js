import React, {useEffect} from 'react';
import {View, Text} from 'react-native';
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated';
import PropTypes from 'prop-types';
import IconButton from './IconButton';
import * as Expensicons from '../Icon/Expensicons';
import ProgressBar from './ProgressBar';
import convertMillisecondsToTime from './utils';
import VolumeButton from '../VolumeButton';

const propTypes = {
    // eslint-disable-next-line react/forbid-prop-types
    duration: PropTypes.number.isRequired,

    position: PropTypes.number.isRequired,

    updatePostiion: PropTypes.func.isRequired,

    togglePlay: PropTypes.func.isRequired,

    enterFullScreenMode: PropTypes.func.isRequired,

    updateVolume: PropTypes.func.isRequired,

    isPlaying: PropTypes.bool,
};

const defaultProps = {
    isPlaying: false,
};

function VideoPlayerControls({duration, position, updatePostiion, togglePlay, enterFullScreenMode, updateVolume, isPlaying}) {
    const [durationFormatted, setDurationFormatted] = React.useState('0:00');

    useEffect(() => {
        setDurationFormatted(convertMillisecondsToTime(duration));
    }, [duration]);

    return (
        <Animated.View
            style={{
                position: 'absolute',
                bottom: 10,
                left: 10,
                right: 10,
                backgroundColor: '#061B09CC',
                height: 60,
                borderRadius: 10,
                flexDirection: 'column',
                overflow: 'visible',
                padding: 10,
            }}
            entering={FadeIn.duration(3000)}
            exiting={FadeOut.duration(3000)}
        >
            <View style={{flex: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <IconButton
                        src={isPlaying ? Expensicons.Pause : Expensicons.Play}
                        fill="white"
                        accessibilityLabel="play/pause"
                        onPress={togglePlay}
                    />
                    <Text style={{color: 'white', width: 35, textAlign: 'center'}}>{convertMillisecondsToTime(position)}</Text>
                    <Text style={{color: 'white'}}>/</Text>
                    <Text style={{color: 'white', width: 35, textAlign: 'center'}}>{durationFormatted}</Text>
                </View>
                <View style={{flexDirection: 'row'}}>
                    <VolumeButton updateVolume={updateVolume} />
                    <IconButton
                        src={Expensicons.Fullscreen}
                        fill="white"
                        accessibilityLabel="fullsreen"
                        onPress={enterFullScreenMode}
                        style={{marginRight: 10}}
                    />
                    <IconButton
                        src={Expensicons.ThreeDots}
                        fill="white"
                        accessibilityLabel="more options"
                    />
                </View>
            </View>
            <View style={{flex: 2, flexDirection: 'row'}}>
                <ProgressBar
                    duration={duration}
                    position={position}
                    updatePostiion={updatePostiion}
                />
            </View>
        </Animated.View>
    );
}

VideoPlayerControls.propTypes = propTypes;
VideoPlayerControls.defaultProps = defaultProps;
VideoPlayerControls.displayName = 'VideoPlayerControls';

export default VideoPlayerControls;
