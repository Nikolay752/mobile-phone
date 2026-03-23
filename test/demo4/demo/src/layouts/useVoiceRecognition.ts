import { useState, useEffect, useRef } from 'react';


// 扩展TS全局类型：直接适配原生API，避免自定义构造函数导致的类型不匹配
declare global {
    interface Window {
        // 直接声明为任意构造函数，兼容原生webkit前缀和标准API
        SpeechRecognition?: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    }
}

// 核心：适配原生SpeechRecognition的实例接口（包含所有原生属性/方法）
interface SpeechRecognitionInstance {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number; // 新增：原生API必选属性，避免初始化缺失
    // 修正事件参数类型：适配原生SpeechRecognitionEvent，解决results空值报错
    onresult?: (event: SpeechRecognitionEvent) => void;
    onerror?: (event: SpeechRecognitionErrorEvent) => void;
    onend?: () => void;
    start: () => void;
    stop: () => void;
    abort: () => void; // 新增：终止识别方法，强化销毁逻辑
}

// 自定义Hook：语音识别核心逻辑（彻底修复所有错误）
export const useVoiceRecognition = (onRecognitionComplete: (text: string) => void) => {
    const [isRecording, setIsRecording] = useState(false);
    const isRecordingRef = useRef(isRecording); // 新增 ref 追踪状态
    const [recognition, setRecognition] = useState<SpeechRecognitionInstance | null>(null);
    const [isSupported, setIsSupported] = useState(true);

    useEffect(() => {
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        if (!SpeechRecognition) {
            setIsSupported(false);
            return;
        }
        const rec = new SpeechRecognition();
        rec.lang = 'zh-CN';
        rec.continuous = false;
        rec.interimResults = false;
        rec.maxAlternatives = 1;

        rec.onresult = (event) => {
            if (!event.results || event.results.length === 0 || event.results[0].length === 0) {
                console.warn('未识别到语音内容');
                setIsRecording(false);
                isRecordingRef.current = false;
                return;
            }
            const transcript = event.results[0][0].transcript.trim();
            if (transcript) onRecognitionComplete(transcript);
            setIsRecording(false);
            isRecordingRef.current = false;
        };

        rec.onerror = (event) => {
            console.error('语音识别错误:', event.error, event.message);
            if (event.error === 'not-allowed') alert('麦克风权限被拒绝，请在浏览器设置中开启权限后重试');
            else if (event.error === 'no-speech') alert('未检测到语音输入，请重新尝试');
            else alert(`语音识别失败：${event.error}`);
            setIsRecording(false);
            isRecordingRef.current = false;
        };

        rec.onend = () => {
            if (isRecordingRef.current) { // 用 ref 判断，不再依赖 state
                setIsRecording(false);
                isRecordingRef.current = false;
            }
        };

        setRecognition(rec);

        return () => {
            if (rec) {
                rec.stop();
                rec.abort();
                setRecognition(null);
            }
            setIsRecording(false);
            isRecordingRef.current = false;
        };
    }, [onRecognitionComplete]); // ✅ 移除 isRecording 依赖，循环终止

    // toggleVoiceInput 中同步更新 ref
    // useVoiceRecognition.ts - 改造 toggleVoiceInput
    const toggleVoiceInput = () => {
        if (!isSupported) return;
        if (isRecording) {
            // 停止逻辑不变
            recognition?.stop();
            recognition?.abort();
            setRecognition(null);
            setIsRecording(false);
            isRecordingRef.current = false;
        } else {
            // 移动端：延迟启动，确保在用户点击事件栈内
            setTimeout(() => {
                try {
                    // 重建实例（避免缓存导致的权限问题）
                    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
                    if (!SpeechRecognition) {
                        setIsSupported(false);
                        alert('当前浏览器不支持语音识别');
                        return;
                    }
                    const newRec = new SpeechRecognition();
                    newRec.lang = 'zh-CN';
                    newRec.continuous = false;
                    newRec.interimResults = false;
                    newRec.maxAlternatives = 1;
                    newRec.onresult = rec.onresult;
                    newRec.onerror = rec.onerror;
                    newRec.onend = rec.onend;
                    setRecognition(newRec);
                    newRec.start();
                    setIsRecording(true);
                    isRecordingRef.current = true;
                } catch (err) {
                    console.error('启动语音识别失败:', err);
                    setIsRecording(false);
                    isRecordingRef.current = false;
                    // 更精准的错误提示：区分权限/不支持
                    if ((err as Error).message.includes('permission')) {
                        alert('麦克风权限被拒绝，请在手机「设置-隐私-麦克风」中开启本浏览器权限');
                    } else {
                        alert('语音识别启动失败，请检查网络或浏览器版本');
                    }
                }
            }, 100); // 延迟100ms，确保在用户点击事件中
        }
    };

    return { isRecording, isSupported, toggleVoiceInput };
};