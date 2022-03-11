import logo from "./logo.svg";
import { useState, useRef, useEffect } from "react";
import "./App.css";
// import { VRSetup } from "./ThreeJSComponents/VRSetup";
import { Moving } from "./ThreeJSComponents/Moving";
import { Architecture } from "./ThreeJSComponents/Architecture";
import { Archi } from "./ThreeJSComponents/Archi";
import { FinalArchi } from "./ThreeJSComponents/FinalArchi";
import { PFE } from "./ThreeJSComponents/PFE";

function App() {
  const container = useRef(null);

  useEffect(() => {
    if (container) {
      let loader = new PFE(container.current)
    }
  },[container])

  return (
    <div className="App" ref={container}>
    </div>
  )
}

export default App;
