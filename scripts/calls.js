// Start Javascript and JQuery Calls
jQuery(function($) {
  // Tabs: expanding, accordion-esque
  $('#tab-tanks a').click(function(){
    if(!$(this).hasClass('active')) {
      $(this).addClass('active');
      $('#tab-garden a').removeClass('active');
      $('#tab-lawn a').removeClass('active');
      $('#settings').removeClass('active');
      $('#panel-tanks .extended').slideDown(200);
      $('#panel-garden .extended').slideUp(200);
      $('#panel-lawn .extended').slideUp(200);
      $('#footer .extended').slideUp(200);
    }
    else {
      $(this).removeClass('active');
      $('#panel-tanks .extended').slideUp(200);
    }
  });
  $('#tab-garden a').click(function(){
    if(!$(this).hasClass('active')) {
      $(this).addClass('active');
      $('#tab-tanks a').removeClass('active');
      $('#tab-lawn a').removeClass('active');
      $('#settings').removeClass('active');
      $('#panel-tanks .extended').slideUp(200);
      $('#panel-garden .extended').slideDown(200);
      $('#panel-lawn .extended').slideUp(200);
      $('#footer .extended').slideUp(200);
    }
    else {
      $(this).removeClass('active');
      $('#panel-garden .extended').slideUp(200);
    }
  });
  $('#tab-lawn a').click(function(){
    if(!$(this).hasClass('active')) {
      $(this).addClass('active');
      $('#tab-tanks a').removeClass('active');
      $('#tab-garden a').removeClass('active');
      $('#settings').removeClass('active');
      $('#panel-tanks .extended').slideUp(200);
      $('#panel-garden .extended').slideUp(200);
      $('#panel-lawn .extended').slideDown(200);
      $('#footer .extended').slideUp(200);
    }
    else {
      $(this).removeClass('active');
      $('#panel-lawn .extended').slideUp(200);
    }
  });
  $('#settings').click(function(){
    if(!$(this).hasClass('active')) {
      $(this).addClass('active');
      $('#footer .extended').slideDown(200);
    }
    else {
      $(this).removeClass('active');
      $('#footer .extended').slideUp(200);
    }
  });
  // Garden panel
  $('#garden-on').click(function() {
    $(this).addClass('active');
    $('#garden-off').removeClass('active');
  });
  $('#garden-off').click(function() {
    $(this).addClass('active');
    $('#garden-on').removeClass('active');
  });
  $('#garden-schedule-set').click(function(){
    scheduleSave('garden');
  });
  $('#garden-schedule-clear').click(function(){
    $('#garden-schedule-on').val('');
    $('#garden-schedule-off').val('');
    $('input[name="garden-days"]').each(function() {
      $(this).prop('checked', false)
    });
  });
  // Lawn panel
  $('#lawn-on').click(function() {
    $(this).addClass('active');
    $('#lawn-off').removeClass('active');
  });
  $('#lawn-off').click(function() {
    $(this).addClass('active');
    $('#lawn-on').removeClass('active');
  });
  $('#lawn-schedule-set').click(function(){
    scheduleSave('lawn');
  });
  $('#lawn-schedule-clear').click(function(){
    $('#lawn-schedule-on').val('');
    $('#lawn-schedule-off').val('');
    $('input[name="lawn-days"]').each(function() {
      $(this).prop('checked', false)
    });
  });

  // Ajax Calls
  // Generic button ID handler
  $('.ajaxid').click(function(){
    var task = this.id;
    $.ajax({
      method: 'POST',
      url: 'functions.php?'+task,
      success: function(data) {message(data);}
    });
  });
  // Schedule setter
  function scheduleSave(channel) {
    var days = 'days:';
    $('input[name="'+channel+'-days"]').each(function() {
      if ($(this).is(':checked')) {
        days += $(this).val();
      }
    });
    var on = $('#'+channel+'-schedule-on').val();
    var off = $('#'+channel+'-schedule-off').val();
    if(days.length && on.length && off.length) {
      $.ajax({
        method: 'POST',
        url: 'functions.php?'+channel+'-schedule-set',
        data: {on: on, off: off, days: days},
        success: function(data) {message(data);}
      });
    }
    else {
      message('Please enter schedule days and times');
    }
  }
  // History period setter
  $('#tank-history-select').change(function() {
    var period = $(this).val();
    $.ajax({
      method: 'POST',
      url: 'functions.php?tank-history-update',
      data: {period: period},
      success: function(data) {message(data);}
    });
  });
  // Message area in the footer
  function message(data) {
    $('#messages').html('<p>'+data+'</p>');
  }
  // On document.ready, render the tank history as a chart
  $(document).ready(function() {
    $('table.tank-visual-history')
    .bind('highchartTable.beforeRender', function(e, highChartConfig) {highChartConfig.yAxis[0].max = 100;})
    .highchartTable();
  });
});
