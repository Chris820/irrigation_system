<?php
// What's the day and time?
$day = date('N');
$now = date('H:i');
// Read the schedules
$garden_schedule = file_get_contents('/var/www/html/data/schedules/garden');
$lawn_schedule = file_get_contents('/var/www/html/data/schedules/lawn');
// Do the switching if $now matches
if ($garden_schedule != '') {
	$garden_schedule = explode('|',$garden_schedule);
	if(strpos($garden_schedule[2],$day)) {
		if ($garden_schedule[0] == $now) {
			system('gpio -g mode 27 out');
			system('gpio -g write 27 0');
		}
		if ($garden_schedule[1] == $now) {
			system('gpio -g mode 27 out');
			system('gpio -g write 27 1');
		}
	}
}
if ($lawn_schedule != '') {
	$lawn_schedule = explode('|',$lawn_schedule);
	if(strpos($lawn_schedule[2],$day)) {
		if ($lawn_schedule[0] == $now) {
			system('gpio -g mode 4 out');
			system('gpio -g write 4 0');
		}
		if ($lawn_schedule[1] == $now) {
			system('gpio -g mode 4 out');
			system('gpio -g write 4 1');
		}
	}
}

# Every hour check the tank levels.
if (date('gi') % 100 == 0) {
	// Take a bunch of measurements
	$measurements = array();
	$i = 0;
	while ($i < 24) {
		$measurement = shell_exec('python /var/www/html/measure.py');
		if ($measurement) $measurements[$i] = $measurement;
		$i++;
		sleep(.1);
	}
	// Find the mode then filter the measurements to it, this helps remove outliers
	$mode = find_mode($measurements);
	$trimmed_measurements = array_filter($measurements, function($value) use ($mode) {
		if (strpos(strval($value),strval($mode)) === 0) return true;
		else return false;
	});
	// Average the remainders
	$average_measurement = array_sum($trimmed_measurements) / count($trimmed_measurements);
	// Write to file
	$level =  time() .'|'. $average_measurement;
	file_put_contents('/var/www/html/data/levels',$level . "\n", FILE_APPEND);
	file_put_contents('/var/www/html/data/level',$level);
}

# Helper: Find the mode of the measurements (to the centimetre)
function find_mode($dataset) {
	$count = array();
  foreach ($dataset as $value) {
		$value = substr($value,0,2);
		if (isset($count[$value])) $count[$value]++;
		else $count[$value] = 1;
	}
	$mode = '';
	$iter = 0;
	foreach ($count as $k => $v) {
		if ($v > $iter) {
			$mode = $k;
			$iter = $v;
		}
	}
	return $mode;
}
