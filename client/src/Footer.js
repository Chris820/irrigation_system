import React, { Component } from 'react';
import io from 'socket.io-client';

class Footer extends Component {
  constructor() {
    super();
    // Define state values
    this.state = {
      expanded: false,
      feedback: ''
    }
  }
  
  // Mount the component
  componentDidMount() {
    this.socket = io();
    this.fetchData();
    this.timer = setInterval(() => this.fetchData(), 250);
  }
  
  // Fetch the latest bit of feedback from server API
  fetchData() {
    fetch('/api/feedback')
      .then(response => response.json())
      .then(result => {
        this.setState({feedback: result});
    })
  }
  
  // Show and hide the expanded panel
  toggleExpanded = () => {
    this.setState({expanded: !this.state.expanded});
  }
  
  // Clean up
  goCleanUp = (event) => {
    event.stopPropagation();
    this.socket.emit('cleanUp', 1);
  }
  
  render() {
    return (
      <div className="footer">
        <button aria-label="Toggle settings" aria-controls="settings-details" className={this.state.expanded ? 'settings animated': 'settings'} aria-expanded={this.state.expanded} onClick={this.toggleExpanded}>Settings</button>
        <div className="expanded" id="settings-details" style={{display: this.state.expanded ? 'block': 'none'}}>     
          <button onClick={this.goCleanUp}>Clean up</button>
        </div>
        <div id="messages"><p>{this.state.feedback}</p></div>
      </div>
    );
  }
}
export default Footer;
