
const APIkey = 'AIzaSyAp18PsB4Zsqne0TYo8LnhY5avbdzsUIwQ';

// ytSearchMain에서 검색 버튼 눌렀을 때 플라스크 타고 넘어오는 값
var Request = function() {
    this.getParameter = function(name) {  
        var rtnval = '';  
        var nowAddress = decodeURI(location.href);  
        console.log("주소가 뭐지" + nowAddress); // 한글 인코딩이 제대로 됐는지 확인
        var parameters = (nowAddress.slice(nowAddress.indexOf('?') + 1,  
                nowAddress.length)).split('&');  
        for (var i = 0; i < parameters.length; i++) {  
            var varName = parameters[i].split('=')[0];  
            if (varName.toUpperCase() == name.toUpperCase()) {  
                rtnval = parameters[i].split('=')[1];  
                break;  
            }  
        }  
        return rtnval;  
    }  
}  
var request = new Request();  

var paramValue = request.getParameter('searchBox');
paramValue = paramValue.replace(/[.*+?^${}()|[\]\\]/g, ' '); // 값이 넘어올 때 특수문자 공백 처리
console.log("넘어온 검색어 : " + paramValue);
document.getElementById("searchBox").value = paramValue;
fnGetList();

// keyword 눌렀을 때 연관검색어로 재검색 해주는 함수 실행
var keywords = $('.keyword');
keywords.each(function(index) {
    $(this).click(function(){
        // console.log($(this));
        var kwValue = $(this).text();
        $("#searchBox").val(kwValue);
        $("#searchBtn").click();
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

            $(jdata.items).each(function (key, value) {

                var videoId = this.id.videoId;
                var vdTitle = this.snippet.title; // 각 영상 제목
                var fragment = $(document.createDocumentFragment());
                
                // 각 영상 아이디로 조회수를 가져오기 위한 API url
                var vdDetails = "https://www.googleapis.com/youtube/v3/videos?part=statistics&id="+ videoId +"&key=" + APIkey;
                // 각 영상의 채널 아이디로 채널 썸네일 url 가져오기 위한 API url
                var chThumbnailUrl = "https://www.googleapis.com/youtube/v3/channels?part=snippet&id="+this.snippet.channelId+"&key=" + APIkey;
                
                callViewFetch();

                // 조회수 가져오는 fetch
                function callViewFetch() {
                    fetch(vdDetails)
                    .then(function(response) {
                        return response.json();  
                    }).then (function (myJson) {
                        var viewCounts = myJson.items[0].statistics.viewCount;
                        callChFetch(viewCounts);
                        return viewCounts;
                    });
                };
                
                // 채널 썸네일 및 채널명 가져오는 fetch + makeVideoFragment() 실행
                // 위의 callViewFetch() 실행되고 나서 이 fetch 실행되도록 async/await 걸어뒀음
                async function callChFetch(viewCounts) {
                    await fetch(chThumbnailUrl)
                        .then(function (response) {
                            return response.json();
                        })
                        .then(function (myJson) { 
                            var chThumbnail = myJson.items[0].snippet.thumbnails.default.url;
                            var chTitle =  myJson.items[0].snippet.title;

                            makeVideoFragment(videoId, chThumbnail, vdTitle, chTitle, viewCounts);
                        });
                }
                
                // 영상 리스트 추가하는 makeVideoFragment() 함수
                function makeVideoFragment(videoId, chThumbnail, vdTitle, chTitle, viewCounts) {

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
                                        '<div class="itsSm">영상 요약</div>',
                                        '<div class="summary"></div>',
                                        '<div class="down">자세히 보기</div>',
                                        '<div class="up">간략히</div>',
                                    '</div>', // end .summaryWrap
                                '</div>', // end .infos
                            '</div>', // end. infosWrap
                        '</li>'
                    ].join(""));

                    $('#videoList').append(fragment) // #videoList에 만든 fragment들 append해서 뷰에 출력
                    
                    // iframe 영상 크기 뷰 크기에 맞게 변하도록 설정
                    var videoIframe = $(".video");
                    var responsiveHeight = videoIframe[videoIframe.length-1].offsetWidth * 0.5625;
                    videoIframe[videoIframe.length-1].setAttribute('height', responsiveHeight);
                    $(window).resize(function(){
                        responsiveHeight = videoIframe[videoIframe.length-1].offsetWidth * 0.5625;
                        videoIframe[videoIframe.length-1].setAttribute('height', responsiveHeight);
                    });

                } // end makeVideoFragment()

                setSummary(); // 처음 검색할 때 요약정보 설정

            // end $(jdata.items).each문 : searchUrl 실행 ajax 결과 데이터 = jdata
            }).promise().done(function(){
                // 이전 페이지 함수
                if(jdata.prevPageToken){
                    $("#nav_view").append("<div class='prevPage'>이전 페이지</div>");

                    $('.prevPage').click(function() {
                        $.ajax({
                            type:"GET",
                            url:decodeURI("http://127.0.0.1:5000/search"),
                            data: {
                                pageToken : jdata.prevPageToken,
                                searchBox : searchBox
                            },
                            dataType: 'json',
                            success: function(data) {
                                fnGetList(jdata.prevPageToken);
                                setSummary(data); // 요약 정보 적용
                            },
                            error: function() {
                                alert("안됩니다.");
                            }
                        }) // end. ajax
                    }); // end $('.prevPage').click()
                }
                // 다음 페이지 함수
                if(jdata.nextPageToken){
                    $("#nav_view").append("<div class='nextPage'>다음 페이지</div>");

                    $('.nextPage').click(function() {
                        $.ajax({
                            type:"GET",
                            url:decodeURI("http://127.0.0.1:5000/search"),
                            data: {
                                pageToken : jdata.nextPageToken,
                                searchBox : searchBox
                            },
                            dataType: 'json',
                            success: function(data) {
                                fnGetList(jdata.nextPageToken);
                                setSummary(data); // 요약 정보 적용
                            },
                            error: function() {
                                alert("안됩니다.");
                            }
                        }) // end. ajax
                    }); // end $('.nextPage').click()

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

// 요약 정보 적용하는 함수
function setSummary(data) {
    if(data) {
        setTimeout(function() {
            $('.summary').each(function(index) { 
                $(this).text(data['summary'][index]);
            });
        }, 1400);
    } else {
        setTimeout(function() {
            var smJson = JSON.parse({{smJson|tojson|safe}});
            $('.summary').each(function(index) { 
                $(this).text(smJson['summary'][index]);
            });    
        }, 900);
    }
};


// 펼쳐보기 클릭 이벤트
function fnFolder() {
    setTimeout(function () {

        var downBtns = $('.down');
        var upBtns = $('.up');
        var summaries = $('.summary');
        
        downBtns.each(function(index) {
            $(this).click(function(){
                // console.log(index + "번째 더보기 클릭됐다!");
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

	