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



/*
  TODO:
  - Render history table with highcharts
  - Can i get both tank histories into the one json file? What's possible with node cron
  - Determine the on/off state of each channel by the value returned from the GPIO pins. 
  - Turn on/off each channel
  - Set schedules
  - How to write the scedules and have them trigger the GPIO via node crons?
  - Housekeeping functions in the footer



*/
