
const APIkey = 'AIzaSyASSx2CBL9QhpjLwkxLM5tJebVP0LHQYm0';
var summary = "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.";

// ytSearchMain에서 검색 버튼 눌렀을 때 플라스크 타고 넘어오는 값
var jData = '{{searchBox}}';
console.log(jData);
var paramValue = jData;
console.log("이건 검색어 : " + paramValue);
console.log($("#searchBox"));
$('#searchBox').val(paramValue);
var test = $("#searchBox").val();
console.log(test);
fnGetList();

// keyword 눌렀을 때 연관검색어로 재검색 해주는 함수 실행
var keywords = $('.keyword');
console.log(keywords);

keywords.each(function(index) {
    $(this).click(function(){
        // console.log($(this));
        var kwValue = $(this).text();
        $("#searchBox").val(kwValue);
        fnGetList();
        fnFolder();
    });
});

// 검색 버튼을 눌렀을 때 호출하는 함수
function fnGetList(sGetToken){
    var searchBox = $("#searchBox").val();
    if(searchBox==""){
        alert("검색어를 입력하세요.");
        $("#searchBox").focus();
        return;
    }
    $("#videoList").empty();
    $("#nav_view").empty()

    // 검색 결과에 따른 영상
    var searchUrl = "https://www.googleapis.com/youtube/v3/search?part=snippet&order=relevance&q="+ encodeURIComponent(searchBox) +"&key=" + APIkey;
    if(sGetToken){
        searchUrl += "&pageToken="+sGetToken;
    }
    $.ajax({
        type: "GET",
        url: searchUrl,
        dataType: "jsonp",
        success: function(jdata) {
            //console.log(jdata); // searchUrl 실행 후 jdata

            $(jdata.items).each(function (key, value) {

                console.log(this.id.videoId); // 검색한 영상들의 각 videoId (each문이니까 하나씩)
                var videoId = this.id.videoId;
                var vdTitle = this.snippet.title; // 각 영상 제목
                var fragment = $(document.createDocumentFragment());
                // console.log("이건 channelId >> " + this.snippet.channelId); // 검색한 각 영상의 채널 아이디

                // 각 영상의 채널 아이디로 채널 이미지 url 가져오기 위한 API url
                var chThumbnailUrl = "https://www.googleapis.com/youtube/v3/channels?part=snippet&id="+this.snippet.channelId+"&key=" + APIkey;
                // 각 영상의 채널 아이디로 조회수를 가져오기 위한 API url
                var vdDetails = "https://www.googleapis.com/youtube/v3/videos?part=statistics&id="+ videoId +"&key=" + APIkey;

                var viewCounts = "";

                function callDetails() {
                    var view = fetch(vdDetails)
                        .then(function(response) {
                            return response.json();  
                        }).then (function (myJson) {
                            // console.log("result는 뭘까 ▼");
                            // console.log(myJson);
                            // console.log("viewCount는! " + myJson.items[0].statistics.viewCount);
                            viewCounts = myJson.items[0].statistics.viewCount;
                            // console.log("안에서 찍은 viewCounts : " + viewCounts);
                            // callbackFunc(viewCounts);
                            callFetch(viewCounts);
                            return viewCounts;
                        });
                    // console.log("async fetch 실행 후 fetch 밖 callDetails() 안에서 찍어보는 view")
                    // console.log(view);
                    return view;
                };
                
                callDetails(); 
                
                // fetch() :
                // 채널 아이디 url 실행 및 영상 iframe 추가 함수 makeVideoFragment() 실행 
                async function callFetch(viewCounts) {
                    await fetch(chThumbnailUrl)
                        .then(function (response) {
                            return response.json();
                        })
                        .then(function (myJson) { 
                            var chThumbnail = myJson.items[0].snippet.thumbnails.default.url;
                            var chTitle =  myJson.items[0].snippet.title;
                            
                            // console.log("videoId랑 chThumbnail이랑 videoTitle");
                            // console.log(videoId); // fetch 밖에서 한 개의 videoId
                            // console.log(chThumbnail);
                            // console.log(chTitle);
                            // console.log("chThumbnailUrl에서 찍어보는 viewCounts : " + viewCounts);
                            makeVideoFragment(videoId, chThumbnail, vdTitle, chTitle, viewCounts);
                        });
                }
                
                // fetch()에서 실행하는 makeVideoFragment() 함수
                function makeVideoFragment(videoId, chThumbnail, vdTitle, chTitle, viewCounts) {
                    // console.log(videoId); // fetch에서 매개변수로 넘긴 videoId가 잘 넘어왔는지 확인
                    // 매개변수들로 추가 생성하는 fragment
                    fragment.append( [
                        '<li class="videoBox">',
                            '<div class="iframeBox">',
                                '<iframe class="video" width="360px" src="https://www.youtube.com/embed/' + videoId + '" frameborder="0" allow="encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>',
                            '</div>',

                            '<div class="infosWrap">',
                                '<div class="infos">',
                                    '<div class="titleBox">',
                                        '<a href="/watch?videoId='+ videoId +'" class="title">'+ vdTitle +'</a>',
                                        '<div class="thumbBox">',
                                            '<img class="chThumbnail" src="' + chThumbnail + '" alt="channelThumbnail">' ,

                                            '<div class="dtWrap">',
                                                '<span class="details">'+chTitle+' &middot 조회수 '+viewCounts+'회</span>',
                                            '</div>',
                                        '</div>', // end .thumbBox
                                    '</div>', // end .titleBox

                                    '<div class="summaryWrap">',
                                        '<div class="summary">'+ summary +'</div>',
                                        '<div class="down">자세히 보기</div>',
                                        '<div class="up">간략히</div>',
                                    '</div>', // end .summaryWrap
                                '</div>', // end .infos
                            '</div>', // end. infosWrap
                        '</li>'
                    ].join(""));
                    // console.log(fragment) // fragment가 잘 생성됐는지 확인
                    $('#videoList').append(fragment) // #videoList에 만든 fragment들 append해서 뷰에 출력
                    
                    // iframe 영상 크기 뷰 크기에 맞게 변하도록 설정
                    var videoIframe = $(".video");
                    var responsiveHeight = videoIframe[videoIframe.length-1].offsetWidth * 0.5625;
                    videoIframe[videoIframe.length-1].setAttribute('height', responsiveHeight);
                    // console.log(videoIframe[videoIframe.length-1]); // 추가되는 영상Iframe 콘솔에 찍어보자
                    // console.log(responsiveHeight); // 그리고 높이 값도 콘솔에 찍어보자
                    $(window).resize(function(){
                        responsiveHeight = videoIframe[videoIframe.length-1].offsetWidth * 0.5625;
                        videoIframe[videoIframe.length-1].setAttribute('height', responsiveHeight);
                    });

                } // end makeVideoFragment()
            }).promise().done(function(){
                if(jdata.prevPageToken){
                    $("#nav_view").append("<a href='javascript:fnGetList(\""+jdata.prevPageToken+"\");' class='prevPage'>이전페이지</a>");
                }
                if(jdata.nextPageToken){
                    $("#nav_view").append("<a href='javascript:fnGetList(\""+jdata.nextPageToken+"\");' class='nextPage'>더보기</a>");
                }
            });
            fnFolder();
        },
        error:function(xhr, textStatus) {
            console.log(xhr.responseText);
            alert("지금은 시스템 사정으로 인하여 요청하신 작업이 이루어지지 않았습니다.\n잠시후 다시 이용하세요.[2]");
            return;
        }
    });
} // end fnGetList()


// navbar 영역 클릭 이벤트
const searchBtn = $('.rtSearch');
// const scIcon = $('.scIcon');
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
    searchBtn.css('display', 'block');
    back.css('display', 'none');
});

// 뒤로 버튼에 hover 했을 때 tooltip 뜨게 하기
$(function () {
    $('[data-toggle="tooltip"]').tooltip()
})


// 펼쳐보기 클릭 이벤트
function fnFolder() {
    setTimeout(function () {

        var downBtns = $('.down');
        var upBtns = $('.up');
        var summaries = $('.summary');
        
        console.log("downBtns 잘 잡았나")
        console.log(downBtns);
        console.log("첫번째 down 버튼의 html : " + downBtns.eq(0).html());
        
        downBtns.each(function(index) {
            $(this).click(function(){
                console.log(index + "번째 더보기 클릭됐다!");
                summaries.eq(index).css('overflow', 'inherit');
                summaries.eq(index).css('white-space', 'inherit');
                $(this).css('display', 'none');
                upBtns.eq(index).css('display', 'inline-block');
            });
        });

        upBtns.each(function(index) {
            $(this).click(function(){
                summaries.eq(index).css('overflow', 'hidden');
                summaries.eq(index).css('white-space', 'nowrap');
                $(this).css('display', 'none');
                downBtns.eq(index).css('display', 'inline-block');
            });
        });

    }, 1000);
};

	