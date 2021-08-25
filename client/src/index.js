import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

import Tanks from './Tanks';
import Gardens from './Gardens';
import Lawns from './Lawns';
import Footer from './Footer';

ReactDOM.render(
  <React.StrictMode>
    <Tanks />
    <Gardens />
    <Lawns />
    <Footer />
  </React.StrictMode>,
  document.getElementById('body')
);
