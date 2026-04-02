import React from "react";
import Gobang from "../GobangModule/Gobang"
import Styles from "../GobangModule/page.less"
import button from "../layouts/button_back.less"
import { useNavigate } from 'umi';

export default function GamePage() {
  const navigate = useNavigate();
  const handleBackClick = () => {
    navigate('/game');
  };
  return (
    <div className={Styles.main}>
      <div className={Styles.header}>
        <h1>Let's play Gobang.</h1>
        <div className={button.button}
          onClick={handleBackClick}
        >
          back
        </div>

      </div>
      <div className={Styles.body}>
        <Gobang />
      </div>
      <div className={Styles.footer}>

      </div>
    </div>
  );
}