import { useState } from 'react'
import type { FC } from 'react'

const App: FC = () => {
  const [count, setCount] = useState(0)

  return (
    <div>
      <h1>Narratrix</h1>
      <div>
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
    </div>
  )
}

export default App
