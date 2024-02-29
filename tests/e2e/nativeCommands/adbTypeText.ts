import execAsync from '../utils/execAsync';
import * as Logger from '../utils/logger';

const adbTypeText = async (text: string) => {
    Logger.log(`📝 Typing text: ${text}`);
    await execAsync(`adb shell input text "${text}"`);
    return true;
};

export default adbTypeText;
