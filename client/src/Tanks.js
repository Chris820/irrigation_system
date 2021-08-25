import React, { Component } from 'react';
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

class Tanks extends Component {
  constructor() {
    super();   
    // Define state values
    this.state = {
      tank1Percent: 0,
      tank1History: [],
      tank2Percent: 0,
      tank2History: [],
      expanded: false,
      period: 24,
      // Defaults for the Highchart
      chartOptions: {
        title: null,
        chart: {
          height: 256,
          type: 'line',
        },
        colors: [
          '#4d6d9a','#c96567'
        ],
        credits: {
          enabled: false,
        },
        time: {
          timezoneOffset: -600,
        },
        tooltip: {
          dateTimeLabelFormats:{
            millisecond: "%H:%M,  %e %B %Y",
            second: "%l%P,  %e %B %Y",
          }
        },
        yAxis: {
          title: {
            enabled: false,
          },
          max: 100,
          min: 0,
        },
        xAxis: {
          type: 'datetime',
          visible: false,
        },
      },
    }
    // Bind the periodChange interaction
    this.periodChange = this.periodChange.bind(this);
   
  } // End constructor

  // Mount the component
  componentDidMount() {
    this.fetchData();
    this.getSavedStates();
    this.timer = setInterval(() => this.fetchData(), 5000);
  }

  // Fetch the Tank Level data from server API
  fetchData() {
    fetch('/api/tank1Level')
      .then(response => response.json())
      .then(result => {
        this.setState({tank1Percent: result[1]})
      })
    fetch('/api/tank2Level')
      .then(response => response.json())
      .then(result => {
        this.setState({tank2Percent: result[1]})
      }) 
    fetch('/api/tank1History')
      .then(response => response.json())
      .then(result => {
        this.setState({tank1History: result})
      })
    fetch('/api/tank2History')
      .then(response => response.json())
      .then(result => {
        this.setState({tank2History: result})
      })
    this.updateHistoryData(this.state.period);
  }

  // Get the saved states from localStorage
  getSavedStates = () => {
    let saved_period = localStorage.getItem('period'); 
    if(saved_period && saved_period !== undefined) { 
      this.setState({period: (JSON.parse(saved_period))})
    }
    let saved_tank_panel = localStorage.getItem('tank_panel'); 
    if(saved_tank_panel && saved_tank_panel !== undefined) {
      this.setState({expanded: (JSON.parse(saved_tank_panel))})
      this.updateHistoryData(this.state.period);
      }
  }

  // Show and hide the expanded panel
  toggleExpanded = () => {
    this.setState({expanded: !this.state.expanded});
    localStorage.setItem('tank_panel', JSON.stringify(!this.state.expanded));
    this.updateHistoryData(this.state.period);
  }

   // Save the history reporting period
  periodChange(event) {
    this.setState({period: event.target.value});
    localStorage.setItem('period', JSON.stringify(event.target.value));
    this.updateHistoryData(event.target.value);
  }

  updateHistoryData = (period) => {
    // Get a slice of the history
    let history1 = this.state.tank1History.slice(-period);
    let history2 = this.state.tank2History.slice(-period);
    // This history array can sometimes be too big to render. So for certain periods remove all but every nth item.
    var skip = undefined;
    if (period === '744') skip = 3;
    if (period === '2190') skip = 6;
    if (period === '8760') skip = 12;
    if (period === '0') skip = 24;
    if (skip) {
      history1 = history1.filter(function(e, i) {
        return i % skip === 0;
      });
      history2 = history2.filter(function(e, i) {
        return i % skip === 0;
      });
    }
    // Update the Highchart
    this.setState({
      chartOptions: {
        series: [
          {name: 'Tank 1', data: history1},
          {name: 'Tank 2', data: history2} 
        ]
      }
    });  
  }

  render() {
    return (
      <div className="tanks panel">
        <button aria-label="Toggle tank details" aria-controls="tank-details" className={this.state.expanded ? 'tab expanded': 'tab'} aria-expanded={this.state.expanded} onClick={this.toggleExpanded}><span>Tanks</span></button>
        <div className="tank1 tank-visual">
          <div className="tank-visual-inner" style={{ height: + this.state.tank1Percent +'%'}}></div>
          <p style={{ bottom: + this.state.tank1Percent +'%'}}>{this.state.tank1Percent}%</p>
        </div>
        <div className="tank2 tank-visual">
          <div className="tank-visual-inner" style={{ height: + this.state.tank2Percent +'%'}}></div>
          <p style={{ bottom: + this.state.tank2Percent +'%'}}>{this.state.tank2Percent}%</p>
        </div>
        <div id="tank-details" className="expanded" style={{display: this.state.expanded ? 'block': 'none'}}>
          <HighchartsReact highcharts={Highcharts} options={this.state.chartOptions} />
          <select className="tank-history-select" value={this.state.period} onChange={this.periodChange}>
            <option value="24">Day</option>
            <option value="72">3 day</option>
            <option value="168">Week</option>
            <option value="744">Month</option>
            <option value="2190">Quarter</option>
            <option value="8760">Year</option>
            <option value="0">All time</option>
          </select>
        </div>
      </div>
    );
  }
}
export default Tanks;
