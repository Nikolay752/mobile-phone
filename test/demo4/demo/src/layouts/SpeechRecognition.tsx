import { useState } from 'react';
import { useVoiceRecognition } from './useVoiceRecognition';

declare global {
  const agent: {
    panel: {
      show: () => void;
    };
  };
}

const AgentChat = () => {
  const [agentLoading, setAgentLoading] = useState(false);

  // 语音识别回调：识别完成后注入到PageAgent并发送
  const handleRecognitionComplete = (text: string) => {
    if (!text) return;
    injectToPageAgentInput(text);
    setAgentLoading(false); // 识别完成后重置loading
  };

  const { isRecording, isSupported, toggleVoiceInput } = useVoiceRecognition(handleRecognitionComplete);

  // 注入文本到PageAgent输入框
  const injectToPageAgentInput = (text: string) => {
    const inputEl = document.querySelector('.page-agent-input') as HTMLInputElement | null;
    const sendBtn = document.querySelector('.page-agent-send-btn') as HTMLButtonElement | null;

    if (inputEl && sendBtn) {
      inputEl.value = text;
      inputEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      sendBtn.click();
    } else {
      console.warn('未找到PageAgent输入框/发送按钮，请检查DOM选择器');
      setTimeout(() => injectToPageAgentInput(text), 500);
    }
  };

  // 改造后的打开助手逻辑：自动启动语音识别
  const handleAgentChat = () => {
    if (!isSupported) {
      alert('当前浏览器不支持语音识别！');
      return;
    }
    if (agentLoading || isRecording) return;

    setAgentLoading(true);
    // 1. 打开助手面板
    if (!agent) {
      alert('智能助手尚未加载完成！');
      setAgentLoading(false);
      return;
    }
    agent.panel.show();
    // 2. 自动启动语音录音
    try {
      toggleVoiceInput();
    } catch (err) {
      console.error('启动语音识别失败:', err);
      setAgentLoading(false);
      alert('语音识别启动失败！');
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px', margin: '10px', alignItems: 'center' }}>
      <button
        onClick={handleAgentChat}
        disabled={agentLoading || isRecording || !isSupported}
        style={{ 
          padding: '6px 12px', 
          background: isRecording ? '#ff4d4f' : '#1890ff',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: !isSupported ? 'not-allowed' : (agentLoading || isRecording ? 'not-allowed' : 'pointer'),
        }}
      >
      </button>
      {!isSupported && <span style={{ color: '#999', fontSize: '12px' }}>（浏览器不支持）</span>}
    </div>
  );
};

export default AgentChat;