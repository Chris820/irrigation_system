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
  if ($garden_schedule != '') {
    $status['garden']['schedule'] = explode('|',$garden_schedule);
  }
  if ($lawn_schedule != '') {
    $status['lawn']['schedule'] = explode('|',$lawn_schedule);
  }
  // Tank levels
  $tank_current = file_get_contents('/var/www/html/data/level');
  $tank_history = file_get_contents('/var/www/html/data/levels');
  $status['tank']['level'] = explode('|',$tank_current);
  $status['tank']['history']['all'] = explode("\n",$tank_history);
  array_pop($status['tank']['history']['all']);
  foreach($status['tank']['history']['all'] as $key => $row) {
    $row = explode('|',$row);
    $status['tank']['history']['all'][$row[0]] = $row[1];
    unset($status['tank']['history']['all'][$key]);
  }
  // Slice up the tank levels for time periods
  $status['tank']['history']['day'] = array_slice($status['tank']['history']['all'],-24,NULL,TRUE);
  $status['tank']['history']['week'] = array_slice($status['tank']['history']['all'],-168,NULL,TRUE);
  $status['tank']['history']['month'] = array_slice($status['tank']['history']['all'],-744,NULL,TRUE);
  $status['tank']['history']['quarter'] = array_slice($status['tank']['history']['all'],-2190,NULL,TRUE);
  $status['tank']['history']['half'] = array_slice($status['tank']['history']['all'],-4380,NULL,TRUE);
  $status['tank']['history']['year'] = array_slice($status['tank']['history']['all'],-8760,NULL,TRUE);
  // Get the tank history reporting period
  $status['tank']['history']['period'] = 'all';
  $status['tank']['history']['period'] = file_get_contents('/var/www/html/data/period');
  // Return
  return $status;
}
$status = getstatus(); ?>

<h2 id="tab-tanks" class="tab"><a href="#" aria-label="Toggle tank details" aria-controls="tank-details"><span>Tank</span></a></h2>
<div id="panel-tanks" class="panel">
  <?php // Work out the tank level as a percentage
  // TODO: Adjust for empty value
  $tank_empty = 2000;
  $tank_full = 271;
  $level = trim($status['tank']['level'][1]);
  $level = round((100 - (($level - $tank_full) * 100) / ($tank_empty - $tank_full)),1,PHP_ROUND_HALF_DOWN);
  $label_date = date('g:ia, j F Y',$status['tank']['level'][0]); ?>
  <div class="tank-visual">
    <div class="tank-visual-inner" style="height:<?php echo $level;?>%"></div>
    <p style="bottom:<?php echo $level;?>%;"><?php echo $level;?>%</p>
  </div>
  <div class="extended" id="tank-details">
    <table class="tank-visual-history"
      data-graph-container-before="1"
      data-graph-type="area"
      data-graph-line-shadow="0"
      data-graph-line-width="1"
      data-graph-height="220"
      data-graph-xaxis-labels-font-size=".6em"
      data-graph-xaxis-labels-enabled="0"
      data-graph-xaxis-rotation="290"
      data-graph-legend-disabled="1"
      style="display:none;">
      <thead>
      <tr>
        <th scope="col">Date</th>
        <th scope="col">Level</th>
      </tr>
      </thead>
      <tbody>
      <?php
      $period = $status['tank']['history']['period'];
      $history = $status['tank']['history'][$period];
      foreach($history as $date => $level) {
        echo '<tr>';
        echo '<td>'.date('ga, Y-m-d', $date).'</td>';
        $level = (100 - (($level - $tank_full) * 100) / ($tank_empty - $tank_full));
        $level = round($level, 1,PHP_ROUND_HALF_DOWN);
        echo '<td>'.$level.'%</td>';
        echo '</tr>';
      } ?>
      </tbody>
    </table>
    <select id="tank-history-select">
      <option <?php if($period == 'day') echo 'selected'; ?> value="day">Day</option>
      <option <?php if($period == 'week') echo 'selected'; ?> value="week">Week</option>
      <option <?php if($period == 'month') echo 'selected'; ?> value="month">Month</option>
      <option <?php if($period == 'quarter') echo 'selected'; ?> value="quarter">Quarter</option>
      <option <?php if($period == 'half') echo 'selected'; ?> value="half">Half year</option>
      <option <?php if($period == 'year') echo 'selected'; ?> value="year">Year</option>
      <option <?php if($period == 'all') echo 'selected'; ?> value="all">All time</option>
    </select>
  </div>
</div>

<h2 id="tab-garden" class="tab"><a href="#" aria-label="Toggle garden details" aria-controls="garden-details"><span>Gardens</span></a></h2>
<div id="panel-garden" class="panel">
  <button id="garden-off" class="primary off ajaxid<?php if($status['garden']['state'] === '1') echo ' active'; ?>">Off</button>
  <button id="garden-on" class="primary on ajaxid<?php if($status['garden']['state'] === '0') echo ' active'; ?>">On</button>
  <div class="extended" id="garden-details">
    <div class="form-radios" role="radiogroup" aria-label="Shedule to run on the following days">
      <input type="checkbox" id="garden-mon" name="garden-days" value="1"<?php if(strpos($status['garden']['schedule'][2],'1')) echo ' checked' ?>>
      <label for="garden-mon">Mon</label>
      <input type="checkbox" id="garden-tue" name="garden-days" value="2"<?php if(strpos($status['garden']['schedule'][2],'2')) echo ' checked' ?>>
      <label for="garden-tue">Tues</label>
      <input type="checkbox" id="garden-wed" name="garden-days" value="3"<?php if(strpos($status['garden']['schedule'][2],'3')) echo ' checked' ?>>
      <label for="garden-wed">Wed</label>
      <input type="checkbox" id="garden-thu" name="garden-days" value="4"<?php if(strpos($status['garden']['schedule'][2],'4')) echo ' checked' ?>>
      <label for="garden-thu">Thurs</label>
      <input type="checkbox" id="garden-fri" name="garden-days" value="5"<?php if(strpos($status['garden']['schedule'][2],'5')) echo ' checked' ?>>
      <label for="garden-fri">Fri</label>
      <input type="checkbox" id="garden-sat" name="garden-days" value="6"<?php if(strpos($status['garden']['schedule'][2],'6')) echo ' checked' ?>>
      <label for="garden-sat">Sat</label>
      <input type="checkbox" id="garden-sun" name="garden-days" value="7"<?php if(strpos($status['garden']['schedule'][2],'7')) echo ' checked' ?>>
      <label for="garden-sun">Sun</label>
    </div>
    <div class="form-times">
      <label for="garden-schedule-on">Turn on at</label>
      <input type="time" id="garden-schedule-on" name="garden-schedule-on" <?php if(isset($status['garden']['schedule'])) echo 'value="'.$status['garden']['schedule'][0].'"'; ?>>
      <label for="garden-schedule-off">Turn off at</label>
      <input type="time" id="garden-schedule-off" name="garden-schedule-off" <?php if(isset($status['garden']['schedule'])) echo 'value="'.$status['garden']['schedule'][1].'"'; ?>>
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
    <div class="form-radios" role="radiogroup" aria-label="Shedule to run on the following days">
      <input type="checkbox" id="lawn-mon" name="lawn-days" value="1"<?php if(strpos($status['lawn']['schedule'][2],'1')) echo ' checked' ?>>
      <label for="lawn-mon">Mon</label>
      <input type="checkbox" id="lawn-tue" name="lawn-days" value="2"<?php if(strpos($status['lawn']['schedule'][2],'2')) echo ' checked' ?>>
      <label for="lawn-tue">Tues</label>
      <input type="checkbox" id="lawn-wed" name="lawn-days" value="3"<?php if(strpos($status['lawn']['schedule'][2],'3')) echo ' checked' ?>>
      <label for="lawn-wed">Wed</label>
      <input type="checkbox" id="lawn-thu" name="lawn-days" value="4"<?php if(strpos($status['lawn']['schedule'][2],'4')) echo ' checked' ?>>
      <label for="lawn-thu">Thurs</label>
      <input type="checkbox" id="lawn-fri" name="lawn-days" value="5"<?php if(strpos($status['lawn']['schedule'][2],'5')) echo ' checked' ?>>
      <label for="lawn-fri">Fri</label>
      <input type="checkbox" id="lawn-sat" name="lawn-days" value="6"<?php if(strpos($status['lawn']['schedule'][2],'6')) echo ' checked' ?>>
      <label for="lawn-sat">Sat</label>
      <input type="checkbox" id="lawn-sun" name="lawn-days" value="7"<?php if(strpos($status['lawn']['schedule'][2],'7')) echo ' checked' ?>>
      <label for="lawn-sun">Sun</label>
    </div>
    <div class="form-times">
      <label for="lawn-schedule-on">Turn on at</label>
      <input type="time" id="lawn-schedule-on" name="lawn-schedule-on" <?php if(isset($status['lawn']['schedule'])) echo 'value="'.$status['lawn']['schedule'][0].'"'; ?>>
      <label for="lawn-schedule-off">Turn off at</label>
      <input type="time" id="lawn-schedule-off" name="lawn-schedule-off" <?php if(isset($status['lawn']['schedule'])) echo 'value="'.$status['lawn']['schedule'][1].'"'; ?>>
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
