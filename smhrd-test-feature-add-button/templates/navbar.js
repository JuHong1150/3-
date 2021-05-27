// navbar 영역 클릭 이벤트
const searchBtn = $('.rtSearch');
const search = $('#search');
const logo = $('.navbar_logo');
const back = $('.back');
// console.log(searchBtn);

searchBtn.click(function(){
    console.log('클릭됐다!');
    logo.css('display', 'none');
    searchBtn.css('display', 'none');
    search.css('display', 'block');
    back.css('display', 'block');
});

back.click(function(){
    search.css('display', 'none');
    logo.css('display', 'flex');
    back.css('display', 'none');
});

$(window).resize(function(){
    if($(window).width() > 768) {
        searchBtn.css('display', 'none');
        search.css('display', 'block');
    } else {
        searchBtn.css('display', 'block');
        search.css('display', 'none');
    }
});

// 뒤로 버튼에 hover 했을 때 tooltip 뜨게 하기
$(function () {
    $('[data-toggle="tooltip"]').tooltip()
})