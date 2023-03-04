import React, { Component } from 'react';
import io from 'socket.io-client';

class Lawns extends Component {
  constructor() {
    super();
    // Define state values
    this.state = {      
      expanded: false,
      active: false,
      days: [
        {id: 'lawn1', value: 1, label:'Mon', isChecked: false},
        {id: 'lawn2', value: 2, label:'Tues', isChecked: false},
        {id: 'lawn3', value: 3, label:'Wed', isChecked: false},
        {id: 'lawn4', value: 4, label:'Thurs', isChecked: false},
        {id: 'lawn5', value: 5, label:'Fri', isChecked: false},
        {id: 'lawn6', value: 6, label:'Sat', isChecked: false},
        {id: 'lawn0', value: 0, label:'Sun', isChecked: false}
      ],
      start: '',
      end: '',
      timer: -1
    }
    // Bind the interactions
    this.handleCheckElement = this.handleCheckElement.bind(this);
    this.handleChangeStart = this.handleChangeStart.bind(this);
    this.handleChangeEnd = this.handleChangeEnd.bind(this);
    this.saveSchedule = this.saveSchedule.bind(this);
    this.clearSchedule = this.clearSchedule.bind(this);
  } // End constructor

  // Mount the component
  componentDidMount() {
    this.socket = io();
    this.fetchData();
    this.getSavedStates();
    this.timer = setInterval(() => this.fetchData(), 250);
  }
  
  // Fetch the actual GPIO state from server API
  fetchData() {
    fetch('/api/isLawnActive')
      .then(response => response.json())
      .then(result => {
        this.setState({active: result});
    })
  }
  
  // Get the saved states from localStorage
  getSavedStates = () => {
    let saved_lawn_panel = localStorage.getItem('lawn_panel'); 
    if(saved_lawn_panel && saved_lawn_panel !== undefined) {
      this.setState({expanded: (JSON.parse(saved_lawn_panel))})
      }
    // And the schedule from the server API
    fetch('/api/lawnSchedule')
      .then(response => response.json())
      .then(result => {
        this.setState({days: result.days});
        this.setState({start: result.start});
        this.setState({end: result.end});
    })
  } 
  
  // Show and hide the expanded panel
  toggleExpanded = () => {
    this.setState({expanded: !this.state.expanded});
    localStorage.setItem('lawn_panel', JSON.stringify(!this.state.expanded));
  }
  
  // Trigger on  
  lawnTriggerOn = (event) => {
    event.stopPropagation();
    this.setState({active: 1});
    this.socket.emit('lawn', 1);
  }
  
  // Trigger off  
  lawnTriggerOff = (event) => {
    event.stopPropagation();
    this.setState({active: 0}); 
    this.socket.emit('lawn', 0);
  }
  
  // Handle changing of schedule days/times
  handleCheckElement(event) {
    let days = this.state.days
    days.forEach((day) => {
      if (Number(day.value) === Number(event.target.value)) 
      day.isChecked = event.target.checked
    })
    this.setState({days: days})
  }
  handleChangeStart(event) {
    this.setState({start: event.target.value});
  }
  handleChangeEnd(event) {
    this.setState({end: event.target.value});
  }
  
  // Save the schedule
  saveSchedule(event) {
    var schedule = {
      days: this.state.days,
      start: this.state.start,
      end: this.state.end,
    }
    this.socket.emit('update_lawn_schedule', schedule);
  }
  
  // Clear the schedule
  clearSchedule(event) {
    var schedule = {
      days: [
        {id: 'lawn1', value: 1, label:'Mon', isChecked: false},
        {id: 'lawn2', value: 2, label:'Tues', isChecked: false},
        {id: 'lawn3', value: 3, label:'Wed', isChecked: false},
        {id: 'lawn4', value: 4, label:'Thurs', isChecked: false},
        {id: 'lawn5', value: 5, label:'Fri', isChecked: false},
        {id: 'lawn6', value: 6, label:'Sat', isChecked: false},
        {id: 'lawn0', value: 0, label:'Sun', isChecked: false}
      ],
      start: '',
      end: '',
    }
    this.setState({days: schedule.days})
    this.setState({start: schedule.start});
    this.setState({end: schedule.end});
    this.socket.emit('update_lawn_schedule', schedule);
  }  

  render() {
    return (
      <div className="lawns panel">
          <button aria-label="Toggle lawn details" aria-controls="lawn-details" className={this.state.expanded ? 'tab expanded': 'tab'} aria-expanded={this.state.expanded} onClick={this.toggleExpanded}><span>Lawns</span></button>
          <button className={this.state.active ? 'trigger off ': 'trigger off latched'} onClick={this.lawnTriggerOff}>Off</button>
          <button className={this.state.active ? 'trigger on latched ': 'trigger on'} onClick={this.lawnTriggerOn}>On</button>
          <div id="lawn-details" className="expanded" style={{display: this.state.expanded ? 'block': 'none'}}>
            <div className="form-checkboxes">          
              {this.state.days.map((day) => {
                return(<div key={day.value}><input id={day.id} type="checkbox" value={day.value} checked={day.isChecked} onChange={this.handleCheckElement} /><label htmlFor={day.id}>{day.label}</label></div>)
              })}
            </div>
            <div className="form-times">
              <label htmlFor="lawn-schedule-on">Turn on at</label>
              <input type="time" id="lawn-schedule-on" value={this.state.start} onChange={this.handleChangeStart} />
              <label htmlFor="lawn-schedule-off">Turn off at</label>
              <input type="time" id="lawn-schedule-off" value={this.state.end} onChange={this.handleChangeEnd} />
            </div>
            <button className="schedule cancel" aria-label="Clear lawn schedule" onClick={this.clearSchedule}>Clear</button>
            <button className="schedule confirm" aria-label="Save lawn schedule" onClick={this.saveSchedule}>Save</button>
          </div>
      </div>
    )
  }
}

export default Lawns;
