import React, { Component } from 'react';
import io from 'socket.io-client';

class Gardens extends Component {
  constructor() {
    super();
    // Define state values
    this.state = {      
      expanded: false,
      active: false,
      days: [
        {id: 'garden1', value: 1, label:'Mon', isChecked: false},
        {id: 'garden2', value: 2, label:'Tues', isChecked: false},
        {id: 'garden3', value: 3, label:'Wed', isChecked: false},
        {id: 'garden4', value: 4, label:'Thurs', isChecked: false},
        {id: 'garden5', value: 5, label:'Fri', isChecked: false},
        {id: 'garden6', value: 6, label:'Sat', isChecked: false},
        {id: 'garden7', value: 7, label:'Sun', isChecked: false}
      ],
      time: {
        start: 0,
        end: 0
      }
    }
    // Bind the handleCheckElement interaction
    this.handleCheckElement = this.handleCheckElement.bind(this);
  } // End constructor

  // Mount the component
  componentDidMount() {
    this.socket = io();
    this.fetchData();
    this.getSavedStates();
    this.timer = setInterval(() => this.fetchData(), 1000);
  }
  
  // Fetch the active state from server API
  fetchData() {
    fetch('/api/isGardenActive')
      .then(response => response.json())
      .then(result => {
        this.setState({active: result});
    })
  }
  
  // Get the saved states from localStorage
  getSavedStates = () => {
    let saved_garden_panel = localStorage.getItem('garden_panel'); 
    if(saved_garden_panel && saved_garden_panel !== undefined) {
      this.setState({expanded: (JSON.parse(saved_garden_panel))})
      }
  }
  
  // Show and hide the expanded panel
  toggleExpanded = () => {
    this.setState({expanded: !this.state.expanded});
    localStorage.setItem('garden_panel', JSON.stringify(!this.state.expanded));
  }
  
  // Trigger on  
  gardenTriggerOn = (event) => {
    event.stopPropagation();
    this.setState({active: 1});
    this.socket.emit('garden', 1);
  }
  
  // Trigger off  
  gardenTriggerOff = (event) => {
    event.stopPropagation();
    this.setState({active: 0}); 
    this.socket.emit('garden', 0);
  }
  
  


  handleCheckElement(event) {
    let days = this.state.days
    days.forEach((day) => {
      if (Number(day.value) === Number(event.target.value)) 
      day.isChecked = event.target.checked
    })
    this.setState({days: days})
  }
  
  

  render() {
    return (
      <div className="gardens panel">
          <button aria-label="Toggle gardens details" aria-controls="gardens-details" className={this.state.expanded ? 'tab expanded': 'tab'} aria-expanded={this.state.expanded} onClick={this.toggleExpanded}><span>Gardens</span></button>
          
          <button className={this.state.active ? 'trigger off ': 'trigger off latched'} onClick={this.gardenTriggerOff}>Off</button>
          <button className={this.state.active ? 'trigger on latched ': 'trigger on'} onClick={this.gardenTriggerOn}>On</button>

          <div id="gardens-details" className="expanded" style={{display: this.state.expanded ? 'block': 'none'}}>
            <div className="form-checkboxes">          
              {this.state.days.map((day) => {
                return(<div key={day.value}><input id={day.id} type="checkbox" value={day.value} checked={day.isChecked} onChange={this.handleCheckElement} /><label htmlFor={day.id}>{day.label}</label></div>)
              })}
            </div>
            
            <button className="schedule cancel" aria-label="Clear garden schedule">Clear</button>
            <button className="schedule confirm" aria-label="Save garden schedule">Save</button>
          </div>
      </div>
    )
  }
}

export default Gardens;
