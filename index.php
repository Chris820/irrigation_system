<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width" />
<meta name="theme-color" content="#4d6d9a" />
<link rel="stylesheet" href="css/main.css" type="text/css" media="all" />
<link rel="stylesheet" href="//fonts.googleapis.com/css?family=Roboto:400,600" type="text/css" media="all" />
<script type="text/javascript" src="https://code.jquery.com/jquery-3.5.1.min.js"></script>
<script type="text/javascript" src="https://code.highcharts.com/highcharts.js"></script>
<script type="text/javascript" src="scripts/highchartTable.js"></script>
<script type="text/javascript" src="scripts/calls.js"></script>
<title>Watering system</title>
</head>
<body>
<?php // Status array
function getstatus() {
  $status = array(
    'garden' => array('state' => 1),
    'lawn' => array('state' => 1),
  );
  // Get the switch state from gpio
  exec('gpio -g read 27', $status['garden']['state']);
  $status['garden']['state'] = $status['garden']['state'][0];
  exec('gpio -g read 4', $status['lawn']['state']);
  $status['lawn']['state'] = $status['lawn']['state'][0];
  // Get the schedules
  $garden_schedule = file_get_contents('/var/www/html/data/schedules/garden');
  $lawn_schedule = file_get_contents('/var/www/html/data/schedules/lawn');
  $status['garden']['schedule'] = array();
  if ($garden_schedule != '') {
    $status['garden']['schedule'] = explode('|',$garden_schedule);
  }
  $status['lawn']['schedule'] = array();
  if ($lawn_schedule != '') {
    $status['lawn']['schedule'] = explode('|',$lawn_schedule);
  }
  // Get the tank reporting period
  $status['tank']['period'] = 'all';
  $status['tank']['period'] = file_get_contents('/var/www/html/data/period');
  // Tank levels
  $tank_current = file_get_contents('/var/www/html/data/level');
  $tank2_current = file_get_contents('/var/www/html/data/level2');
  $tank_history = file_get_contents('/var/www/html/data/levels');
  $tank2_history = file_get_contents('/var/www/html/data/levels2');
  // Current tank levels
  $status['tank']['level1'] = explode('|',$tank_current);
  $status['tank']['level2'] = explode('|',$tank2_current);
  // Build the tank history array
  $status['tank']['history']= explode("\n",$tank_history);
  array_pop($status['tank']['history']);
  // Key the history array by the hourly timestamp
  foreach($status['tank']['history'] as $key => $row) {
    $row = explode('|',$row);
    $status['tank']['history'][$row[0]] = array($row[1]);
    unset($status['tank']['history'][$key]);
  }
  // The second tank is monitored by a different computer on the network (an old Macmini in the back shed)
  // A USB to FTDI interace takes measurements from a HC-SR04 (see ftdi-measure.py)
  // Measurements are written to text files in a manner nearly identical to what's here in cron.php
  // Then at one minute past the hour, a cron job on the Macmini rsyncs these files into the /data folder
  $tank2_history = explode("\n",$tank2_history);
  foreach ($tank2_history as $key => $row) {
    // Add the second tank value to the history array where the hourly timestamps match
    $row = explode('|',$row);
    $status['tank']['history'][$row[0]][] = $row[1];
  }
  // Return
  return $status;
}
$status = getstatus(); ?>

<h2 id="tab-tanks" class="tab"><a href="#" aria-label="Toggle tank details" aria-controls="tank-details"><span>Tanks</span></a></h2>
<div id="panel-tanks" class="panel">
  <?php // Define values for full and empty tanks
  $tank1_empty = 1800;
  $tank1_full = 273;
  $tank2_empty = 1600;
  $tank2_full = 10;
  // Work out the tank levels as a percentage
  $level = trim($status['tank']['level1'][1]);
  $level = round((100 - (($level - $tank1_full) * 100) / ($tank1_empty - $tank1_full)),1,PHP_ROUND_HALF_DOWN);
  if($level > 100) $level = 100;
  $level2 = trim($status['tank']['level2'][1]);
  $level2 = round((100 - (($level2 - $tank2_full) * 100) / ($tank2_empty - $tank2_full)),1,PHP_ROUND_HALF_DOWN);
  if($level2 > 100) $level2 = 100;
  ?>
  <div id="tank1" class="tank-visual">
    <div class="tank-visual-inner" style="height:<?php echo $level;?>%"></div>
    <p style="bottom:<?php echo $level;?>%;"><?php echo $level;?>%</p>
  </div>
  <div id="tank2" class="tank-visual">
    <div class="tank-visual-inner" style="height:<?php echo $level2;?>%"></div>
    <p style="bottom:<?php echo $level2;?>%;"><?php echo $level2;?>%</p>
  </div>
  <div class="extended" id="tank-details">
    <table class="tank-visual-history"
      data-graph-container-before="1"
      data-graph-type="area"
      data-graph-line-shadow="0"
      data-graph-line-width="2"
      data-graph-height="220"
      data-graph-xaxis-labels-font-size=".6em"
      data-graph-xaxis-labels-enabled="0"
      data-graph-xaxis-rotation="290"
      style="display:none;">
      <thead>
      <tr>
        <th scope="col">Date</th>
        <th scope="col">Tank 1</th>
        <th scope="col">Tank 2</th>
      </tr>
      </thead>
      <tbody>
      <?php
      $period = $status['tank']['period'];
      // Get a slice of the history
      if ($period != 'all') $history = array_slice($status['tank']['history'],-$period,NULL,TRUE);
      // Print out the table cells
      foreach($history as $date => $levels) {
        echo '<tr>';
        echo '<td>'.$date.'</td>';
        if (!array_key_exists(1,$levels)) $levels[1] = $tank2_empty; // For when before the second tank was connected
        foreach ($levels as $key => $level) {
          if ($key == 0) { // Use Tank 1 full and empty values
            $level = round((100 - (($level - $tank1_full) * 100) / ($tank1_empty - $tank1_full)),1,PHP_ROUND_HALF_DOWN);
          }
          if ($key == 1) { // Use Tank 2 full and empty values
            $level = round((100 - (($level - $tank2_full) * 100) / ($tank2_empty - $tank2_full)),1,PHP_ROUND_HALF_DOWN);
          }
          if($level > 100) $level = 100;
          echo '<td>'.$level.'%</td>';
        }
        echo '</tr>';
      } ?>
      </tbody>
    </table>
    <select id="tank-history-select">
      <option <?php if($period == '24') echo 'selected'; ?> value="24">Day</option>
      <option <?php if($period == '72') echo 'selected'; ?> value="72">3 day</option>
      <option <?php if($period == '168') echo 'selected'; ?> value="168">Week</option>
      <option <?php if($period == '744') echo 'selected'; ?> value="744">Month</option>
      <option <?php if($period == '2190') echo 'selected'; ?> value="2190">Quarter</option>
      <option <?php if($period == '4380') echo 'selected'; ?> value="4380">Half year</option>
      <option <?php if($period == '8760') echo 'selected'; ?> value="8760">Year</option>
      <option <?php if($period == '0') echo 'selected'; ?> value="0">All time</option>
    </select>
  </div>
</div>

<h2 id="tab-garden" class="tab"><a href="#" aria-label="Toggle garden details" aria-controls="garden-details"><span>Gardens</span></a></h2>
<div id="panel-garden" class="panel">
  <button id="garden-off" class="primary off ajaxid<?php if($status['garden']['state'] === '1') echo ' active'; ?>">Off</button>
  <button id="garden-on" class="primary on ajaxid<?php if($status['garden']['state'] === '0') echo ' active'; ?>">On</button>
  <div class="extended" id="garden-details">
    <div class="form-radios">
      <input type="checkbox" id="garden-mon" name="garden-days" value="1"<?php if(isset($status['garden']['schedule'][2]) && strpos($status['garden']['schedule'][2],'1')) echo ' checked' ?>>
      <label for="garden-mon">Mon</label>
      <input type="checkbox" id="garden-tue" name="garden-days" value="2"<?php if(isset($status['garden']['schedule'][2]) && strpos($status['garden']['schedule'][2],'2')) echo ' checked' ?>>
      <label for="garden-tue">Tues</label>
      <input type="checkbox" id="garden-wed" name="garden-days" value="3"<?php if(isset($status['garden']['schedule'][2]) && strpos($status['garden']['schedule'][2],'3')) echo ' checked' ?>>
      <label for="garden-wed">Wed</label>
      <input type="checkbox" id="garden-thu" name="garden-days" value="4"<?php if(isset($status['garden']['schedule'][2]) && strpos($status['garden']['schedule'][2],'4')) echo ' checked' ?>>
      <label for="garden-thu">Thurs</label>
      <input type="checkbox" id="garden-fri" name="garden-days" value="5"<?php if(isset($status['garden']['schedule'][2]) && strpos($status['garden']['schedule'][2],'5')) echo ' checked' ?>>
      <label for="garden-fri">Fri</label>
      <input type="checkbox" id="garden-sat" name="garden-days" value="6"<?php if(isset($status['garden']['schedule'][2]) && strpos($status['garden']['schedule'][2],'6')) echo ' checked' ?>>
      <label for="garden-sat">Sat</label>
      <input type="checkbox" id="garden-sun" name="garden-days" value="7"<?php if(isset($status['garden']['schedule'][2]) && strpos($status['garden']['schedule'][2],'7')) echo ' checked' ?>>
      <label for="garden-sun">Sun</label>
    </div>
    <div class="form-times">
      <label for="garden-schedule-on">Turn on at</label>
      <input type="time" id="garden-schedule-on" name="garden-schedule-on" <?php if(isset($status['garden']['schedule'][0])) echo 'value="'.$status['garden']['schedule'][0].'"'; ?>>
      <label for="garden-schedule-off">Turn off at</label>
      <input type="time" id="garden-schedule-off" name="garden-schedule-off" <?php if(isset($status['garden']['schedule'][1])) echo 'value="'.$status['garden']['schedule'][1].'"'; ?>>
    </div>
    <button id="garden-schedule-clear" class="secondary cancel ajaxid" aria-label="Clear garden schedule">Clear</button>
    <button id="garden-schedule-set" class="secondary confirm" aria-label="Save garden schedule">Save</button>
  </div>
</div>

<h2 id="tab-lawn" class="tab"><a href="#"aria-label="Toggle lawn details" aria-controls="lawn-details"><span>Lawn</span></a></h2>
<div id="panel-lawn" class="panel">
  <button id="lawn-off" class="primary off ajaxid<?php if($status['lawn']['state'] === '1') echo ' active'; ?>">Off</button>
  <button id="lawn-on" class="primary on ajaxid<?php if($status['lawn']['state'] === '0') echo ' active'; ?>">On</button>
  <div class="extended"  id="lawn-details">
    <div class="form-radios">
      <input type="checkbox" id="lawn-mon" name="lawn-days" value="1"<?php if(isset($status['lawn']['schedule'][2]) && strpos($status['lawn']['schedule'][2],'1')) echo ' checked' ?>>
      <label for="lawn-mon">Mon</label>
      <input type="checkbox" id="lawn-tue" name="lawn-days" value="2"<?php if(isset($status['lawn']['schedule'][2]) && strpos($status['lawn']['schedule'][2],'2')) echo ' checked' ?>>
      <label for="lawn-tue">Tues</label>
      <input type="checkbox" id="lawn-wed" name="lawn-days" value="3"<?php if(isset($status['lawn']['schedule'][2]) && strpos($status['lawn']['schedule'][2],'3')) echo ' checked' ?>>
      <label for="lawn-wed">Wed</label>
      <input type="checkbox" id="lawn-thu" name="lawn-days" value="4"<?php if(isset($status['lawn']['schedule'][2]) && strpos($status['lawn']['schedule'][2],'4')) echo ' checked' ?>>
      <label for="lawn-thu">Thurs</label>
      <input type="checkbox" id="lawn-fri" name="lawn-days" value="5"<?php if(isset($status['lawn']['schedule'][2]) && strpos($status['lawn']['schedule'][2],'5')) echo ' checked' ?>>
      <label for="lawn-fri">Fri</label>
      <input type="checkbox" id="lawn-sat" name="lawn-days" value="6"<?php if(isset($status['lawn']['schedule'][2]) && strpos($status['lawn']['schedule'][2],'6')) echo ' checked' ?>>
      <label for="lawn-sat">Sat</label>
      <input type="checkbox" id="lawn-sun" name="lawn-days" value="7"<?php if(isset($status['lawn']['schedule'][2]) && strpos($status['lawn']['schedule'][2],'7')) echo ' checked' ?>>
      <label for="lawn-sun">Sun</label>
    </div>
    <div class="form-times">
      <label for="lawn-schedule-on">Turn on at</label>
      <input type="time" id="lawn-schedule-on" name="lawn-schedule-on" <?php if(isset($status['lawn']['schedule'][0])) echo 'value="'.$status['lawn']['schedule'][0].'"'; ?>>
      <label for="lawn-schedule-off">Turn off at</label>
      <input type="time" id="lawn-schedule-off" name="lawn-schedule-off" <?php if(isset($status['lawn']['schedule'][1])) echo 'value="'.$status['lawn']['schedule'][1].'"'; ?>>
    </div>
    <button id="lawn-schedule-clear" class="secondary cancel ajaxid" aria-label="Clear lawn schedule">Clear</button>
    <button id="lawn-schedule-set" class="secondary confirm" aria-label="Save lawn schedule">Save</button>
  </div>
</div>

<div id="footer">
  <button id="settings" aria-label="Toggle settings" aria-controls="settings-details">Settings</button>
  <div class="extended" id="settings-details">
    <p><a href="#" id="housekeeping-test" class="ajaxid">Run tests</a></p>
    <p><a href="#" id="housekeeping-cleanup" class="ajaxid">Clean up</a></p>
  </div>
  <div id="messages"><p>&nbsp;</p></div>
</div>
</body>
</html>
