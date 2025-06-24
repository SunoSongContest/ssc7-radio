import "./App.css";
import Wrapper from "./components/Wrapper";
import Player from "./components/Player";

function App() {
  return (
    <Wrapper>
      <Player />
      <span className="credits">Made with ❤️ by Dazorn</span>
    </Wrapper>
  );
}

export default App;
