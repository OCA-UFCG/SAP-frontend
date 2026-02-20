export const GET_HOME_PAGE = `
  query GetHomePage {
    aboutCollection(limit: 1) {
      items {
        sys {
          id
        }
        title
        text {
          json
        }
        image {
          url
          title
          width
          height
        }
      }
    }
  }
`;