<?php
// Switches
if(isset($_GET['garden-on'])) {
  switching(27,0);
  echo 'Garden sprinklers on';
}
if(isset($_GET['garden-off'])) {
  switching(27,1);
  echo 'Garden sprinklers off';
}
if(isset($_GET['lawn-on'])) {
  switching(4,0);
  echo 'Lawn sprinklers on';
}
if(isset($_GET['lawn-off'])) {
  switching(4,1);
   echo 'Lawn sprinklers off';
}
// Do the switching
function switching($channel,$state) {
  system('gpio -g mode '.$channel.' out');
  system('gpio -g write '.$channel.' '.$state);
}
//
// Scheduling
if(isset($_GET['garden-schedule-set'])) {  
  schedule('garden',$_POST['on'] . '|' . $_POST['off']. '|' . $_POST['days']);
  echo 'Garden schedule saved';
}
if(isset($_GET['garden-schedule-clear'])) {
  schedule('garden','');
  echo 'Garden schedule cleared';
}
if(isset($_GET['lawn-schedule-set'])) {
  schedule('lawn',$_POST['on'] . '|' . $_POST['off'] . '|' . $_POST['days']);
  echo 'Lawn schedule saved';
}
if(isset($_GET['lawn-schedule-clear'])) {
  schedule('lawn','');
  echo 'Lawn schedule cleared';
}
// Set the schedules
function schedule($channel, $data) {
  file_put_contents('/var/www/html/data/schedules/'.$channel, $data);
}
//
// Set the tank history period
if(isset($_GET['tank-history-select'])) {
  set_period($_POST['period']);
  echo 'Tank history period updated';
}
function set_period($data) {
  file_put_contents('/var/www/html/data/period',$data);
}
//
// Housekeeping
if(isset($_GET['housekeeping-test'])) {
  system('gpio -g mode 4 out');
  system('gpio -g mode 17 out');
  system('gpio -g mode 22 out');
  system('gpio -g mode 27 out');
  system('gpio -g write 4 0');
  sleep(1);
  system('gpio -g write 4 1');
  sleep(1);
  system('gpio -g write 17 0');
  sleep(1);
  system('gpio -g write 17 1');
  sleep(1);
  system('gpio -g write 22 0');
  sleep(1);
  system('gpio -g write 22 1');
  sleep(1);
  system('gpio -g write 27 0');
  sleep(1);
  system('gpio -g write 27 1');
  echo 'Testing complete';
}
if(isset($_GET['housekeeping-cleanup'])) {
  file_put_contents('/var/www/html/schedules/drippers', '');
  file_put_contents('/var/www/html/schedules/sprinklers', '');
  system('gpio -g mode 4 out');
  system('gpio -g mode 17 out');
  system('gpio -g mode 22 out');
  system('gpio -g mode 27 out');
  system('gpio -g write 4 1');
  system('gpio -g write 17 1');
  system('gpio -g write 22 1');
  system('gpio -g write 27 1');
  echo 'Clean up complete';
}
